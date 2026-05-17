package com.otakutime.app;

import android.app.Dialog;
import android.content.Context;
import android.graphics.Color;
import android.os.Build;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.LinearLayout;
import android.widget.TextView;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.ByteArrayInputStream;

@CapacitorPlugin(name = "MangaWebView")
public class MangaWebViewPlugin extends Plugin {

    private Dialog dialog;
    private WebView webView;

    // Lista nativa de palavras-chave/redes de anúncios para bloquear instantaneamente
    private static final String[] AD_HOSTS = {
        "googleads", "doubleclick", "googlesyndication", "adservice", "adsystem",
        "popads", "popunder", "taboola", "outbrain", "exoclick", "propellerads",
        "adsterra", "yllix", "hilltopads", "infolinks", "revenuehits", "betano",
        "bwin", "betclic", "casino", "1xbet", "apostas", "gamble", "track", "analytics",
        "ads", "banner", "popup", "sponsor"
    };

    @PluginMethod
    public void open(PluginCall call) {
        String url = call.getString("url");
        String title = call.getString("title", "Manga Reader");

        if (url == null) {
            call.reject("URL is required");
            return;
        }

        getActivity().runOnUiThread(() -> {
            Context context = getContext();
            dialog = new Dialog(context, android.R.style.Theme_NoTitleBar);
            dialog.requestWindowFeature(Window.FEATURE_NO_TITLE);

            // Layout Principal (Vertical)
            LinearLayout mainLayout = new LinearLayout(context);
            mainLayout.setOrientation(LinearLayout.VERTICAL);
            mainLayout.setLayoutParams(new ViewGroup.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT
            ));
            mainLayout.setBackgroundColor(Color.parseColor("#0B0F19")); // Dark background

            // Barra Superior (Toolbar)
            LinearLayout toolbar = new LinearLayout(context);
            toolbar.setOrientation(LinearLayout.HORIZONTAL);
            toolbar.setLayoutParams(new LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    140 // Altura da barra
            ));
            toolbar.setBackgroundColor(Color.parseColor("#111827")); // Slate 900
            toolbar.setPadding(40, 0, 40, 0);
            toolbar.setGravity(android.view.Gravity.CENTER_VERTICAL);

            // Botão Fechar (X)
            TextView closeBtn = new TextView(context);
            closeBtn.setText("✕");
            closeBtn.setTextSize(24);
            closeBtn.setTextColor(Color.WHITE);
            closeBtn.setPadding(0, 20, 50, 20);
            closeBtn.setOnClickListener(v -> {
                if (dialog != null) {
                    dialog.dismiss();
                    dialog = null;
                }
                call.resolve();
            });

            // Título do Mangá
            TextView titleView = new TextView(context);
            titleView.setText(title);
            titleView.setTextSize(18);
            titleView.setTextColor(Color.WHITE);
            titleView.setSingleLine(true);
            titleView.setTypeface(null, android.graphics.Typeface.BOLD);
            LinearLayout.LayoutParams titleParams = new LinearLayout.LayoutParams(
                    0, ViewGroup.LayoutParams.WRAP_CONTENT, 1.0f
            );
            titleView.setLayoutParams(titleParams);

            toolbar.addView(closeBtn);
            toolbar.addView(titleView);

            // Configuração do WebView
            webView = new WebView(context);
            webView.setLayoutParams(new LinearLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    0, 1.0f // Ocupa o resto do ecrã
            ));
            
            WebSettings settings = webView.getSettings();
            settings.setJavaScriptEnabled(true);
            settings.setDomStorageEnabled(true);
            settings.setDatabaseEnabled(true);
            settings.setSupportZoom(true);
            settings.setBuiltInZoomControls(true);
            settings.setDisplayZoomControls(false);
            settings.setJavaScriptCanOpenWindowsAutomatically(false); // Bloqueia popups automáticos
            settings.setSupportMultipleWindows(false); // Bloqueia window.open

            webView.setWebViewClient(new WebViewClient() {
                @Override
                public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                    String reqUrl = request.getUrl().toString().toLowerCase();
                    // Bloqueador de Anúncios Nativo
                    for (String adHost : AD_HOSTS) {
                        if (reqUrl.contains(adHost)) {
                            // Retorna resposta vazia para bloquear o anúncio
                            return new WebResourceResponse("text/plain", "UTF-8", new ByteArrayInputStream(new byte[0]));
                        }
                    }
                    return super.shouldInterceptRequest(view, request);
                }
            });

            webView.setWebChromeClient(new WebChromeClient());

            webView.loadUrl(url);

            mainLayout.addView(toolbar);
            mainLayout.addView(webView);

            dialog.setContentView(mainLayout);
            
            // Configurar Janela para Fullscreen
            Window window = dialog.getWindow();
            if (window != null) {
                window.setLayout(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT);
                window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
                window.setStatusBarColor(Color.parseColor("#111827"));
            }

            dialog.show();
        });
    }
}
