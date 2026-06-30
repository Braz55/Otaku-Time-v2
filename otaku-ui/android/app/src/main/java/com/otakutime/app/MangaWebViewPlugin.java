package com.otakutime.app;

import android.app.Dialog;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.view.KeyEvent;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.EditText;
import android.widget.FrameLayout;
import android.widget.Toast;
import android.content.ClipboardManager;
import android.content.ClipData;
import android.view.inputmethod.EditorInfo;
import android.view.inputmethod.InputMethodManager;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayInputStream;
import java.util.ArrayList;
import java.util.List;

@CapacitorPlugin(name = "MangaWebView")
public class MangaWebViewPlugin extends Plugin {

    private Dialog dialog;
    private FrameLayout webViewContainer;
    private TextView backBtn;
    private TextView forwardBtn;
    private TextView tabCountBtn;
    private EditText addressBar;

    private final List<WebTab> tabs = new ArrayList<>();
    private int activeTabIndex = -1;
    private final String homeUrl = "https://www.google.com";

    // Helper WebTab inner class
    private static class WebTab {
        WebView webView;
        String currentUrl;
        String title;

        WebTab(WebView webView, String url) {
            this.webView = webView;
            this.currentUrl = url;
            this.title = "A carregar...";
        }
    }

    // Lista nativa de domínios de anúncios exatos
    private static final String[] AD_HOSTS = {
        "googleads", "doubleclick", "googlesyndication", "adservice", "adsystem",
        "popads", "popunder", "taboola", "outbrain", "exoclick", "propellerads",
        "adsterra", "yllix", "hilltopads", "infolinks", "revenuehits", "betano",
        "bwin", "betclic", "casino", "1xbet", "apostas", "gamble", "googletagmanager",
        "mgid.com", "adcash.com", "onclickmega", "poptab.net"
    };

    @PluginMethod
    public void open(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.trim().isEmpty()) {
            url = homeUrl;
        }
        final String initialUrl = url;

        getActivity().runOnUiThread(() -> {
            Context context = getActivity();

            // Se o navegador (diálogo) já está aberto, apenas abrimos um novo separador
            if (dialog != null) {
                createNewTab(context, initialUrl);
                call.resolve();
                return;
            }

            dialog = new Dialog(context, android.R.style.Theme_DeviceDefault_NoActionBar);
            dialog.requestWindowFeature(Window.FEATURE_NO_TITLE);

            tabs.clear();
            activeTabIndex = -1;

            // Intercetar o botão físico de voltar do Android
            dialog.setOnKeyListener((dialogInterface, keyCode, keyEvent) -> {
                if (keyCode == KeyEvent.KEYCODE_BACK && keyEvent.getAction() == KeyEvent.ACTION_UP) {
                    if (activeTabIndex >= 0 && activeTabIndex < tabs.size()) {
                        WebView activeWv = tabs.get(activeTabIndex).webView;
                        if (activeWv != null && activeWv.canGoBack()) {
                            activeWv.goBack();
                            return true; // Retrocedeu na história do WebView
                        } else if (tabs.size() > 1) {
                            closeTab(context, activeTabIndex);
                            return true; // Fechou o separador ativo e focou no anterior
                        }
                    }
                }
                return false; // Permite fechar o dialog (fim dos separadores/história)
            });

            dialog.setOnDismissListener(dialogInterface -> {
                for (WebTab tab : tabs) {
                    try {
                        tab.webView.destroy();
                    } catch (Exception ignored) {}
                }
                tabs.clear();
                activeTabIndex = -1;
                dialog = null;
            });

            // Layout Principal (Vertical)
            LinearLayout mainLayout = new LinearLayout(context);
            mainLayout.setOrientation(LinearLayout.VERTICAL);
            mainLayout.setLayoutParams(new ViewGroup.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT
            ));
            mainLayout.setBackgroundColor(Color.parseColor("#0B0F19"));
            mainLayout.setFitsSystemWindows(true);

            // Barra Superior (Chrome-like Toolbar)
            LinearLayout toolbar = new LinearLayout(context);
            toolbar.setOrientation(LinearLayout.HORIZONTAL);
            toolbar.setLayoutParams(new LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    140
            ));
            toolbar.setBackgroundColor(Color.parseColor("#111827"));
            toolbar.setPadding(25, 0, 25, 0);
            toolbar.setGravity(android.view.Gravity.CENTER_VERTICAL);

            // Botão Home (🏠)
            TextView homeBtn = new TextView(context);
            homeBtn.setText("🏠");
            homeBtn.setTextSize(20);
            homeBtn.setTextColor(Color.WHITE);
            homeBtn.setPadding(15, 10, 15, 10);
            homeBtn.setOnClickListener(v -> {
                if (activeTabIndex >= 0 && activeTabIndex < tabs.size()) {
                    tabs.get(activeTabIndex).webView.loadUrl(homeUrl);
                }
            });

            // Barra de Endereço (EditText)
            addressBar = new EditText(context);
            addressBar.setSingleLine(true);
            addressBar.setTextSize(13);
            addressBar.setTextColor(Color.WHITE);
            addressBar.setBackgroundColor(Color.parseColor("#1F2937"));
            addressBar.setPadding(20, 10, 20, 10);
            addressBar.setImeOptions(EditorInfo.IME_ACTION_GO);
            addressBar.setInputType(android.text.InputType.TYPE_CLASS_TEXT | android.text.InputType.TYPE_TEXT_VARIATION_URI);
            LinearLayout.LayoutParams addressBarParams = new LinearLayout.LayoutParams(
                    0, ViewGroup.LayoutParams.WRAP_CONTENT, 1.0f
            );
            addressBarParams.setMargins(15, 0, 15, 0);
            addressBar.setLayoutParams(addressBarParams);

            addressBar.setOnEditorActionListener((v, actionId, event) -> {
                if (actionId == EditorInfo.IME_ACTION_GO || actionId == EditorInfo.IME_ACTION_DONE ||
                    (event != null && event.getKeyCode() == KeyEvent.KEYCODE_ENTER && event.getAction() == KeyEvent.ACTION_DOWN)) {
                    String text = addressBar.getText().toString().trim();
                    if (!text.isEmpty()) {
                        String targetUrl = text;
                        if (!targetUrl.startsWith("http://") && !targetUrl.startsWith("https://")) {
                            if (targetUrl.contains(".") && !targetUrl.contains(" ")) {
                                targetUrl = "https://" + targetUrl;
                            } else {
                                try {
                                    targetUrl = "https://www.google.com/search?q=" + java.net.URLEncoder.encode(targetUrl, "UTF-8");
                                } catch (Exception e) {
                                    targetUrl = "https://www.google.com/search?q=" + targetUrl;
                                }
                            }
                        }
                        loadUrlInActiveTab(targetUrl);
                        // Ocultar teclado
                        InputMethodManager imm = (InputMethodManager) context.getSystemService(Context.INPUT_METHOD_SERVICE);
                        if (imm != null) {
                            imm.hideSoftInputFromWindow(addressBar.getWindowToken(), 0);
                        }
                        addressBar.clearFocus();
                    }
                    return true;
                }
                return false;
            });

            // Botão Copiar Link (🔗)
            TextView copyBtn = new TextView(context);
            copyBtn.setText("🔗");
            copyBtn.setTextSize(20);
            copyBtn.setTextColor(Color.WHITE);
            copyBtn.setPadding(15, 10, 15, 10);
            copyBtn.setOnClickListener(v -> {
                if (activeTabIndex >= 0 && activeTabIndex < tabs.size()) {
                    String urlToCopy = tabs.get(activeTabIndex).currentUrl;
                    if (urlToCopy != null) {
                        ClipboardManager clipboard = (ClipboardManager) context.getSystemService(Context.CLIPBOARD_SERVICE);
                        ClipData clip = ClipData.newPlainText("URL", urlToCopy);
                        if (clipboard != null) {
                            clipboard.setPrimaryClip(clip);
                            Toast.makeText(context, "Link copiado!", Toast.LENGTH_SHORT).show();
                        }
                    }
                }
            });

            // Botão Contador de Separadores ([ N ])
            tabCountBtn = new TextView(context);
            tabCountBtn.setText("[1]");
            tabCountBtn.setTextSize(14);
            tabCountBtn.setTextColor(Color.WHITE);
            tabCountBtn.setTypeface(null, android.graphics.Typeface.BOLD);
            tabCountBtn.setPadding(15, 10, 15, 10);
            tabCountBtn.setOnClickListener(v -> showTabsDialog(context));

            toolbar.addView(homeBtn);
            toolbar.addView(addressBar);
            toolbar.addView(copyBtn);
            toolbar.addView(tabCountBtn);

            // Container do WebView (FrameLayout)
            webViewContainer = new FrameLayout(context);
            webViewContainer.setLayoutParams(new LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    0, 1.0f
            ));

            // Barra Inferior (Navegação Básica)
            LinearLayout bottomBar = new LinearLayout(context);
            bottomBar.setOrientation(LinearLayout.HORIZONTAL);
            bottomBar.setLayoutParams(new LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    140
            ));
            bottomBar.setBackgroundColor(Color.parseColor("#111827"));
            bottomBar.setGravity(android.view.Gravity.CENTER_VERTICAL);
            bottomBar.setPadding(40, 0, 40, 0);

            // Voltar
            backBtn = new TextView(context);
            backBtn.setText("◀");
            backBtn.setTextSize(20);
            backBtn.setTextColor(Color.parseColor("#4B5563"));
            backBtn.setEnabled(false);
            backBtn.setGravity(android.view.Gravity.CENTER);
            backBtn.setLayoutParams(new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.MATCH_PARENT, 1.0f));
            backBtn.setOnClickListener(v -> {
                if (activeTabIndex >= 0 && activeTabIndex < tabs.size()) {
                    WebView activeWv = tabs.get(activeTabIndex).webView;
                    if (activeWv != null && activeWv.canGoBack()) {
                        activeWv.goBack();
                    }
                }
            });

            // Avançar
            forwardBtn = new TextView(context);
            forwardBtn.setText("▶");
            forwardBtn.setTextSize(20);
            forwardBtn.setTextColor(Color.parseColor("#4B5563"));
            forwardBtn.setEnabled(false);
            forwardBtn.setGravity(android.view.Gravity.CENTER);
            forwardBtn.setLayoutParams(new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.MATCH_PARENT, 1.0f));
            forwardBtn.setOnClickListener(v -> {
                if (activeTabIndex >= 0 && activeTabIndex < tabs.size()) {
                    WebView activeWv = tabs.get(activeTabIndex).webView;
                    if (activeWv != null && activeWv.canGoForward()) {
                        activeWv.goForward();
                    }
                }
            });

            // Recarregar (↻)
            TextView refreshBtn = new TextView(context);
            refreshBtn.setText("↻");
            refreshBtn.setTextSize(22);
            refreshBtn.setTextColor(Color.WHITE);
            refreshBtn.setGravity(android.view.Gravity.CENTER);
            refreshBtn.setLayoutParams(new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.MATCH_PARENT, 1.0f));
            refreshBtn.setOnClickListener(v -> {
                if (activeTabIndex >= 0 && activeTabIndex < tabs.size()) {
                    WebView activeWv = tabs.get(activeTabIndex).webView;
                    if (activeWv != null) {
                        activeWv.reload();
                    }
                }
            });

            // Fechar (✕)
            TextView closeBtn = new TextView(context);
            closeBtn.setText("✕");
            closeBtn.setTextSize(22);
            closeBtn.setTextColor(Color.WHITE);
            closeBtn.setGravity(android.view.Gravity.CENTER);
            closeBtn.setLayoutParams(new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.MATCH_PARENT, 1.0f));
            closeBtn.setOnClickListener(v -> {
                if (dialog != null) {
                    dialog.dismiss();
                    dialog = null;
                }
            });

            bottomBar.addView(backBtn);
            bottomBar.addView(forwardBtn);
            bottomBar.addView(refreshBtn);
            bottomBar.addView(closeBtn);

            mainLayout.addView(toolbar);
            mainLayout.addView(webViewContainer);
            mainLayout.addView(bottomBar);

            dialog.setContentView(mainLayout);

            Window window = dialog.getWindow();
            if (window != null) {
                window.setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT);
                window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    window.setStatusBarColor(Color.parseColor("#111827"));
                    window.setNavigationBarColor(Color.parseColor("#111827"));
                }
            }

            createNewTab(context, initialUrl);

            dialog.show();
            call.resolve();
        });
    }

    private void createNewTab(Context context, String url) {
        WebView webView = new WebView(context);
        webView.setLayoutParams(new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));

        setupWebViewSettings(webView);

        WebTab tab = new WebTab(webView, url);
        tabs.add(tab);

        setupWebViewClients(webView, tab);

        webView.loadUrl(url);
        switchToTab(tabs.size() - 1);
    }

    private void setupWebViewSettings(WebView wv) {
        WebSettings settings = wv.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setLoadsImagesAutomatically(true);
        settings.setBlockNetworkImage(false);
        settings.setBlockNetworkLoads(false);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
            CookieManager.getInstance().setAcceptThirdPartyCookies(wv, true);
        }
        settings.setUserAgentString("Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36");
        settings.setSupportZoom(true);
        settings.setBuiltInZoomControls(true);
        settings.setDisplayZoomControls(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
    }

    private void setupWebViewClients(WebView wv, final WebTab tab) {
        wv.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                super.onPageStarted(view, url, favicon);
                tab.currentUrl = url;
                if (isCurrentTab(tab)) {
                    addressBar.setText(url);
                    updateNavigationButtons();
                }
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                tab.currentUrl = url;
                tab.title = view.getTitle();
                if (isCurrentTab(tab)) {
                    addressBar.setText(url);
                    updateNavigationButtons();
                    updateTabCountButton();
                }
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                if (!url.startsWith("http://") && !url.startsWith("https://")) {
                    return true;
                }

                String lowerUrl = url.toLowerCase();
                for (String adHost : AD_HOSTS) {
                    if (lowerUrl.contains(adHost)) {
                        return true;
                    }
                }
                return false;
            }

            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                String reqUrl = request.getUrl().toString().toLowerCase();
                for (String adHost : AD_HOSTS) {
                    if (reqUrl.contains(adHost)) {
                        return new WebResourceResponse("text/plain", "UTF-8", new ByteArrayInputStream(new byte[0]));
                    }
                }
                return super.shouldInterceptRequest(view, request);
            }
        });

        wv.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onReceivedTitle(WebView view, String title) {
                super.onReceivedTitle(view, title);
                tab.title = title;
                if (isCurrentTab(tab)) {
                    updateTabCountButton();
                }
            }
        });
    }

    private boolean isCurrentTab(WebTab tab) {
        if (activeTabIndex >= 0 && activeTabIndex < tabs.size()) {
            return tabs.get(activeTabIndex) == tab;
        }
        return false;
    }

    private void switchToTab(int index) {
        if (index < 0 || index >= tabs.size()) return;
        activeTabIndex = index;
        WebTab activeTab = tabs.get(activeTabIndex);

        webViewContainer.removeAllViews();
        webViewContainer.addView(activeTab.webView);

        addressBar.setText(activeTab.currentUrl);
        updateNavigationButtons();
        updateTabCountButton();
    }

    private void closeTab(Context context, int index) {
        if (index < 0 || index >= tabs.size()) return;

        WebView wv = tabs.get(index).webView;
        wv.loadUrl("about:blank");
        wv.clearHistory();
        wv.removeAllViews();
        wv.destroy();

        tabs.remove(index);

        if (tabs.isEmpty()) {
            if (dialog != null) {
                dialog.dismiss();
                dialog = null;
            }
            activeTabIndex = -1;
        } else {
            if (activeTabIndex >= tabs.size()) {
                activeTabIndex = tabs.size() - 1;
            }
            switchToTab(activeTabIndex);
        }
    }

    private void loadUrlInActiveTab(String url) {
        if (activeTabIndex >= 0 && activeTabIndex < tabs.size()) {
            tabs.get(activeTabIndex).webView.loadUrl(url);
        }
    }

    private void updateNavigationButtons() {
        if (activeTabIndex >= 0 && activeTabIndex < tabs.size()) {
            WebView activeWv = tabs.get(activeTabIndex).webView;
            if (activeWv != null) {
                if (activeWv.canGoBack()) {
                    backBtn.setTextColor(Color.WHITE);
                    backBtn.setEnabled(true);
                } else {
                    backBtn.setTextColor(Color.parseColor("#4B5563"));
                    backBtn.setEnabled(false);
                }

                if (activeWv.canGoForward()) {
                    forwardBtn.setTextColor(Color.WHITE);
                    forwardBtn.setEnabled(true);
                } else {
                    forwardBtn.setTextColor(Color.parseColor("#4B5563"));
                    forwardBtn.setEnabled(false);
                }
            }
        }
    }

    private void updateTabCountButton() {
        if (tabCountBtn != null) {
            tabCountBtn.setText("[" + tabs.size() + "]");
        }
    }

    private void showTabsDialog(Context context) {
        String[] items = new String[tabs.size() + 1];
        for (int i = 0; i < tabs.size(); i++) {
            WebTab tab = tabs.get(i);
            String title = tab.title != null ? tab.title : "Sem título";
            items[i] = (i + 1) + ". " + title + "\n(" + tab.currentUrl + ")";
        }
        items[tabs.size()] = "+ Novo Separador";

        new android.app.AlertDialog.Builder(context, android.app.AlertDialog.THEME_DEVICE_DEFAULT_DARK)
                .setTitle("Separadores Abertos")
                .setItems(items, (dialogInterface, which) -> {
                    if (which == tabs.size()) {
                        createNewTab(context, homeUrl);
                    } else {
                        showTabOptionsDialog(context, which);
                    }
                })
                .show();
    }

    private void showTabOptionsDialog(Context context, final int tabIndex) {
        WebTab tab = tabs.get(tabIndex);
        String title = tab.title != null ? tab.title : "Separador";
        String[] options = {"Focar Separador", "Fechar Separador", "Cancelar"};

        new android.app.AlertDialog.Builder(context, android.app.AlertDialog.THEME_DEVICE_DEFAULT_DARK)
                .setTitle(title)
                .setItems(options, (dialogInterface, which) -> {
                    if (which == 0) {
                        switchToTab(tabIndex);
                    } else if (which == 1) {
                        closeTab(context, tabIndex);
                    }
                })
                .show();
    }
}
