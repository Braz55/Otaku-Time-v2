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
import java.util.HashSet;
import java.util.Set;

@CapacitorPlugin(name = "MangaWebView")
public class MangaWebViewPlugin extends Plugin {

    private Dialog dialog;
    private FrameLayout webViewContainer;
    private TextView backBtn;
    private TextView forwardBtn;
    private TextView tabCountBtn;
    private TextView favBtn;
    private EditText addressBar;

    private final List<WebTab> tabs = new ArrayList<>();
    private int activeTabIndex = -1;
    private final String homeUrl = "https://www.google.com";
    private String primaryColorHex = "#8B5CF6";
    private String secondaryColorHex = "#EC4899";

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
            url = "https://local.otakutime.home";
        }
        primaryColorHex = call.getString("primaryColor", "#8B5CF6");
        secondaryColorHex = call.getString("secondaryColor", "#EC4899");
        final String initialUrl = url;

        getActivity().runOnUiThread(() -> {
            Context context = getActivity();

            // Se o navegador (diálogo) já está aberto, apenas abrimos um novo separador
            if (dialog != null) {
                if (initialUrl != null && !initialUrl.startsWith("https://local.otakutime.home")) {
                    createNewTab(context, initialUrl);
                }
                call.resolve();
                return;
            }

            dialog = new Dialog(context, android.R.style.Theme_DeviceDefault_NoActionBar);
            dialog.requestWindowFeature(Window.FEATURE_NO_TITLE);

            tabs.clear();
            activeTabIndex = -1;

            // Tenta carregar separadores guardados na sessão anterior
            loadTabsFromPreferences(context);

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
            mainLayout.setFitsSystemWindows(false);

            // Barra Superior (Chrome-like Toolbar)
            LinearLayout toolbar = new LinearLayout(context);
            toolbar.setOrientation(LinearLayout.HORIZONTAL);
            toolbar.setLayoutParams(new LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    105
            ));
            toolbar.setBackgroundColor(Color.parseColor("#111827"));
            toolbar.setPadding(20, 0, 20, 0);
            toolbar.setGravity(android.view.Gravity.CENTER_VERTICAL);

            // Botão Home (⌂)
            TextView homeBtn = new TextView(context);
            homeBtn.setText("⌂");
            homeBtn.setTextSize(22);
            homeBtn.setTextColor(Color.parseColor(primaryColorHex));
            homeBtn.setPadding(10, 5, 10, 5);
            homeBtn.setOnClickListener(v -> {
                createNewTab(context, "https://local.otakutime.home");
            });

            // Barra de Endereço (EditText)
            addressBar = new EditText(context);
            addressBar.setSingleLine(true);
            addressBar.setTextSize(12);
            addressBar.setTextColor(Color.WHITE);
            addressBar.setBackgroundColor(Color.parseColor("#1F2937"));
            addressBar.setPadding(15, 6, 15, 6);
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

            // Botão Favoritar Estrela (☆/★)
            favBtn = new TextView(context);
            favBtn.setText("☆");
            favBtn.setTextSize(20);
            favBtn.setTextColor(Color.parseColor("#9CA3AF"));
            favBtn.setPadding(10, 5, 10, 5);
            favBtn.setOnClickListener(v -> {
                if (activeTabIndex >= 0 && activeTabIndex < tabs.size()) {
                    toggleBookmark(context, tabs.get(activeTabIndex).currentUrl);
                }
            });

            // Botão Fechar Separador Ativo (✕)
            TextView closeTabBtn = new TextView(context);
            closeTabBtn.setText("✕");
            closeTabBtn.setTextSize(18);
            closeTabBtn.setTextColor(Color.parseColor(primaryColorHex));
            closeTabBtn.setPadding(10, 5, 10, 5);
            closeTabBtn.setOnClickListener(v -> {
                if (activeTabIndex >= 0 && activeTabIndex < tabs.size()) {
                    closeTab(context, activeTabIndex);
                }
            });

            // Botão Contador de Separadores ([ N ])
            tabCountBtn = new TextView(context);
            tabCountBtn.setText("[1]");
            tabCountBtn.setTextSize(13);
            tabCountBtn.setTextColor(Color.parseColor(primaryColorHex));
            tabCountBtn.setTypeface(null, android.graphics.Typeface.BOLD);
            tabCountBtn.setPadding(10, 5, 10, 5);
            tabCountBtn.setOnClickListener(v -> showTabsDialog(context));

            toolbar.addView(homeBtn);
            toolbar.addView(addressBar);
            toolbar.addView(favBtn);
            toolbar.addView(closeTabBtn);
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
                    105
            ));
            bottomBar.setBackgroundColor(Color.parseColor("#111827"));
            bottomBar.setGravity(android.view.Gravity.CENTER_VERTICAL);
            bottomBar.setPadding(30, 0, 30, 0);

            // Voltar
            backBtn = new TextView(context);
            backBtn.setText("◀");
            backBtn.setTextSize(18);
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
            forwardBtn.setTextSize(18);
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
            refreshBtn.setTextSize(20);
            refreshBtn.setTextColor(Color.parseColor(primaryColorHex));
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
            closeBtn.setTextSize(20);
            closeBtn.setTextColor(Color.parseColor(primaryColorHex));
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
                
                // Ativar o Modo Imersivo para ocultar a status bar e navigation bar do sistema Android
                window.getDecorView().setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                );
            }

            // Sempre abre um novo separador com o URL inicial (que é a home por padrão) ao iniciar
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

        if (url != null && url.startsWith("https://local.otakutime.home")) {
            loadHomePage(webView);
        } else {
            webView.loadUrl(url);
        }
        switchToTab(tabs.size() - 1);
        saveTabsToPreferences();
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
                    if (url != null && url.startsWith("https://local.otakutime.home")) {
                        addressBar.setText("");
                        addressBar.setHint("Pesquisar ou digite URL");
                    } else {
                        addressBar.setText(url);
                    }
                    updateNavigationButtons();
                    updateFavButtonState(url);
                }
                saveTabsToPreferences();
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                tab.currentUrl = url;
                if (url != null && url.startsWith("https://local.otakutime.home")) {
                    tab.title = "Otaku Time Home";
                } else {
                    tab.title = view.getTitle();
                    // Injetar script para desativar popups JS (window.open) e forçar links target="_blank" no mesmo separador
                    view.evaluateJavascript(
                        "(function() { " +
                        "  try { " +
                        "    window.open = function() { return null; }; " +
                        "    Object.defineProperty(window, 'open', { value: function() { return null; }, writable: false }); " +
                        "    document.addEventListener('click', function(e) { " +
                        "      var target = e.target; " +
                        "      while (target && target.tagName !== 'A') { target = target.parentNode; } " +
                        "      if (target && target.tagName === 'A') { " +
                        "        if (target.getAttribute('target') === '_blank') { " +
                        "          target.setAttribute('target', '_self'); " +
                        "        } " +
                        "      } " +
                        "    }, true); " +
                        "  } catch(e) {} " +
                        "})();", null
                    );
                }
                if (isCurrentTab(tab)) {
                    if (url != null && url.startsWith("https://local.otakutime.home")) {
                        addressBar.setText("");
                        addressBar.setHint("Pesquisar ou digite URL");
                    } else {
                        addressBar.setText(url);
                    }
                    updateNavigationButtons();
                    updateTabCountButton();
                    updateFavButtonState(url);
                }
                saveTabsToPreferences();
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

                // Sandbox de leitura: Bloquear redirecionamentos automáticos para domínios externos não-confiáveis
                String currentUrl = view.getUrl();
                if (currentUrl != null && !currentUrl.startsWith("https://local.otakutime.home")) {
                    if (isAdOrRedirect(currentUrl, url)) {
                        getActivity().runOnUiThread(() -> {
                            Toast.makeText(getContext(), "Anúncio ou redirecionamento bloqueado", Toast.LENGTH_SHORT).show();
                        });
                        return true; // Bloqueia a navegação indesejada
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
                saveTabsToPreferences();
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

        if (activeTab.currentUrl != null && activeTab.currentUrl.startsWith("https://local.otakutime.home")) {
            addressBar.setText("");
            addressBar.setHint("Pesquisar ou digite URL");
        } else {
            addressBar.setText(activeTab.currentUrl);
        }

        updateNavigationButtons();
        updateTabCountButton();
        updateFavButtonState(activeTab.currentUrl);
        saveTabsToPreferences();
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
        saveTabsToPreferences();
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
                int activeColor = Color.parseColor(primaryColorHex);
                int inactiveColor = Color.parseColor("#4B5563");

                if (activeWv.canGoBack()) {
                    backBtn.setTextColor(activeColor);
                    backBtn.setEnabled(true);
                } else {
                    backBtn.setTextColor(inactiveColor);
                    backBtn.setEnabled(false);
                }

                if (activeWv.canGoForward()) {
                    forwardBtn.setTextColor(activeColor);
                    forwardBtn.setEnabled(true);
                } else {
                    forwardBtn.setTextColor(inactiveColor);
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
        CharSequence[] items = new CharSequence[tabs.size() + 1];
        for (int i = 0; i < tabs.size(); i++) {
            WebTab tab = tabs.get(i);
            String title = tab.title != null ? tab.title : "Sem título";
            String activeIndicator = (i == activeTabIndex) ? "<font color='" + primaryColorHex + "'>● </font>" : "";
            
            String html = "<b>" + activeIndicator + title + "</b><br>" +
                          "<small><font color='#9CA3AF'>" + tab.currentUrl + "</font></small>";
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                items[i] = android.text.Html.fromHtml(html, android.text.Html.FROM_HTML_MODE_LEGACY);
            } else {
                items[i] = android.text.Html.fromHtml(html);
            }
        }
        
        String addHtml = "<b><font color='" + primaryColorHex + "'>+ </font>Novo Separador</b>";
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            items[tabs.size()] = android.text.Html.fromHtml(addHtml, android.text.Html.FROM_HTML_MODE_LEGACY);
        } else {
            items[tabs.size()] = android.text.Html.fromHtml(addHtml);
        }

        new android.app.AlertDialog.Builder(context, android.app.AlertDialog.THEME_DEVICE_DEFAULT_DARK)
                .setTitle("Separadores Abertos")
                .setItems(items, (dialogInterface, which) -> {
                    if (which == tabs.size()) {
                        createNewTab(context, "https://local.otakutime.home");
                    } else {
                        switchToTab(which);
                    }
                })
                .show();
    }

    private void loadHomePage(WebView wv) {
        Context context = wv.getContext();
        android.content.SharedPreferences prefs = context.getSharedPreferences("OtakuTimeBrowserPrefs", Context.MODE_PRIVATE);
        Set<String> bookmarks = prefs.getStringSet("bookmarked_urls", new HashSet<>());

        StringBuilder bookmarksHtml = new StringBuilder();
        if (bookmarks.isEmpty()) {
            bookmarksHtml.append("<div class=\"no-bookmarks\">Adiciona os teus sites favoritos (clicando na estrela ☆ do topo) para veres atalhos rápidos aqui!</div>");
        } else {
            bookmarksHtml.append("<div class=\"section-title\">Atalhos Rápidos</div>");
            bookmarksHtml.append("<div class=\"bookmarks-grid\">");
            for (String b : bookmarks) {
                String displayName = b;
                try {
                    Uri uri = Uri.parse(b);
                    displayName = uri.getHost();
                    if (displayName == null) displayName = b;
                    if (displayName.startsWith("www.")) {
                        displayName = displayName.substring(4);
                    }
                } catch (Exception e) {}

                bookmarksHtml.append(String.format(
                    "<a href=\"%s\" class=\"bookmark-card\"><div class=\"icon\">⭐</div><div class=\"title\">%s</div></a>",
                    b, displayName
                ));
            }
            bookmarksHtml.append("</div>");
        }

        String html = String.format(
            "<!DOCTYPE html><html><head><meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\"><style>body { background-color: #0B0F19; color: #FFFFFF; font-family: -apple-system, BlinkMacSystemFont, Roboto, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; min-height: 100vh; margin: 0; padding: 25px 20px; box-sizing: border-box; } .container { text-align: center; width: 100%%; max-width: 450px; margin-top: 40px; } h1 { font-size: 2.8rem; font-weight: 800; margin-bottom: 2rem; color: %s; letter-spacing: -1.5px; margin-top: 0; } form { width: 100%%; margin-bottom: 30px; } .search-box { display: flex; background: #1F2937; border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 24px; padding: 6px 14px; align-items: center; box-shadow: 0 4px 20px rgba(0,0,0,0.3); } .search-box input { flex: 1; background: transparent; border: none; outline: none; color: white; font-size: 1.05rem; padding: 8px; } .search-box button { background: %s; border: none; border-radius: 16px; color: white; padding: 8px 18px; font-weight: bold; cursor: pointer; transition: background 0.2s; font-size: 0.95rem; } .search-box button:active { opacity: 0.85; } .section-title { font-size: 1.1rem; font-weight: 700; text-align: left; margin: 25px 0 15px 0; color: #9CA3AF; width: 100%%; border-bottom: 1px solid rgba(255, 255, 255, 0.05); padding-bottom: 8px; } .bookmarks-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; width: 100%%; } .bookmark-card { display: flex; flex-direction: column; align-items: center; background: #1F2937; border: 1px solid rgba(255, 255, 255, 0.05); border-radius: 16px; padding: 16px 12px; text-decoration: none; color: white; transition: transform 0.2s, background 0.2s; box-shadow: 0 4px 10px rgba(0,0,0,0.15); } .bookmark-card:active { transform: scale(0.95); background: #374151; } .bookmark-card .icon { font-size: 1.5rem; margin-bottom: 8px; } .bookmark-card .title { font-size: 0.85rem; font-weight: 600; text-align: center; word-break: break-all; max-width: 100%%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; } .no-bookmarks { color: #9CA3AF; font-size: 0.85rem; margin-top: 25px; line-height: 1.6; background: rgba(255, 255, 255, 0.03); padding: 20px; border-radius: 16px; border: 1px dashed rgba(255, 255, 255, 0.1); width: 100%%; box-sizing: border-box; text-align: center; }</style></head><body><div class=\"container\"><h1>Otaku Time</h1><form action=\"https://www.google.com/search\" method=\"get\"><div class=\"search-box\"><input type=\"text\" name=\"q\" placeholder=\"Pesquisar no Google...\" autocomplete=\"off\" required><button type=\"submit\">Ir</button></div></form>%s</div></body></html>",
            primaryColorHex, primaryColorHex, bookmarksHtml.toString()
        );
        wv.loadDataWithBaseURL("https://local.otakutime.home", html, "text/html", "UTF-8", "https://local.otakutime.home");
    }

    // --- Persistência de Separadores e Favoritos via SharedPreferences ---

    private void saveTabsToPreferences() {
        Context context = getContext();
        if (context == null) return;
        android.content.SharedPreferences prefs = context.getSharedPreferences("OtakuTimeBrowserPrefs", Context.MODE_PRIVATE);
        android.content.SharedPreferences.Editor editor = prefs.edit();
        
        int savedCount = 0;
        int savedActiveIndex = 0;
        for (int i = 0; i < tabs.size(); i++) {
            WebTab tab = tabs.get(i);
            if (tab.currentUrl != null && tab.currentUrl.startsWith("https://local.otakutime.home")) {
                continue; // Do not persist home pages
            }
            editor.putString("tab_" + savedCount + "_url", tab.currentUrl);
            editor.putString("tab_" + savedCount + "_title", tab.title);
            if (i == activeTabIndex) {
                savedActiveIndex = savedCount;
            }
            savedCount++;
        }
        editor.putInt("tab_count", savedCount);
        editor.putInt("active_tab_index", savedActiveIndex);
        editor.apply();
    }

    private void loadTabsFromPreferences(Context context) {
        android.content.SharedPreferences prefs = context.getSharedPreferences("OtakuTimeBrowserPrefs", Context.MODE_PRIVATE);
        int tabCount = prefs.getInt("tab_count", 0);
        int savedActiveIndex = prefs.getInt("active_tab_index", -1);
        tabs.clear();
        if (tabCount > 0) {
            for (int i = 0; i < tabCount; i++) {
                String url = prefs.getString("tab_" + i + "_url", "https://local.otakutime.home");
                String title = prefs.getString("tab_" + i + "_title", "Otaku Time Home");

                WebView webView = new WebView(context);
                webView.setLayoutParams(new FrameLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT
                ));
                setupWebViewSettings(webView);

                WebTab tab = new WebTab(webView, url);
                tab.title = title;
                tabs.add(tab);
                setupWebViewClients(webView, tab);

                if (url != null && url.startsWith("https://local.otakutime.home")) {
                    loadHomePage(webView);
                } else {
                    webView.loadUrl(url);
                }
            }
            activeTabIndex = savedActiveIndex;
        }
    }

    private void toggleBookmark(Context context, String url) {
        if (url == null || url.trim().isEmpty() || url.startsWith("https://local.otakutime.home")) {
            return;
        }
        android.content.SharedPreferences prefs = context.getSharedPreferences("OtakuTimeBrowserPrefs", Context.MODE_PRIVATE);
        Set<String> bookmarks = new HashSet<>(prefs.getStringSet("bookmarked_urls", new HashSet<>()));

        if (bookmarks.contains(url)) {
            bookmarks.remove(url);
            Toast.makeText(context, "Removido dos favoritos.", Toast.LENGTH_SHORT).show();
        } else {
            bookmarks.add(url);
            Toast.makeText(context, "Adicionado aos favoritos!", Toast.LENGTH_SHORT).show();
        }

        prefs.edit().putStringSet("bookmarked_urls", bookmarks).apply();
        updateFavButtonState(url);
    }

    private void updateFavButtonState(String url) {
        getActivity().runOnUiThread(() -> {
            if (favBtn == null) return;
            if (url == null || url.startsWith("https://local.otakutime.home")) {
                favBtn.setText("☆");
                favBtn.setTextColor(Color.parseColor("#4B5563"));
                favBtn.setEnabled(false);
                return;
            }
            favBtn.setEnabled(true);
            Context context = getContext();
            if (context == null) return;
            android.content.SharedPreferences prefs = context.getSharedPreferences("OtakuTimeBrowserPrefs", Context.MODE_PRIVATE);
            Set<String> bookmarks = prefs.getStringSet("bookmarked_urls", new HashSet<>());

            if (bookmarks.contains(url)) {
                favBtn.setText("★");
                favBtn.setTextColor(Color.parseColor("#F59E0B")); // Amber 500
            } else {
                favBtn.setText("☆");
                favBtn.setTextColor(Color.parseColor("#9CA3AF")); // Gray 400
            }
        });
    }

    private boolean isAdOrRedirect(String currentUrl, String targetUrl) {
        if (currentUrl == null || targetUrl == null) return false;
        if (targetUrl.startsWith("https://local.otakutime.home")) return false;

        try {
            Uri currentUri = Uri.parse(currentUrl);
            Uri targetUri = Uri.parse(targetUrl);

            String currentHost = currentUri.getHost();
            String targetHost = targetUri.getHost();

            if (currentHost == null || targetHost == null) return false;

            // Normalizar domínios removendo www.
            currentHost = currentHost.replace("www.", "");
            targetHost = targetHost.replace("www.", "");

            // Se os domínios forem iguais ou subdomínios, permitir
            if (targetHost.equals(currentHost) || targetHost.endsWith("." + currentHost) || currentHost.endsWith("." + targetHost)) {
                return false;
            }

            // Domínios confiáveis para login, pesquisa e serviços principais
            String[] trustedDomains = {
                "google.com", "google.pt", "google.co", "google.ad", "googleads",
                "recaptcha.net", "gstatic.com", "googleapis.com", "cloudflare.com",
                "disqus.com", "disquscdn.com", "facebook.com", "twitter.com", "discord.gg",
                "github.com", "git-scm.com"
            };
            for (String trusted : trustedDomains) {
                if (targetHost.contains(trusted)) {
                    return false;
                }
            }

            // Se o domínio for completamente diferente e não confiável, é considerado redirect/anúncio
            return true;
        } catch (Exception e) {
            return false;
        }
    }
}
