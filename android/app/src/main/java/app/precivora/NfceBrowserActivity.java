package app.precivora;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.graphics.Color;
import android.graphics.Typeface;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import org.json.JSONArray;

/**
 * Abre a consulta da NFC-e no site da Fazenda. A pessoa passa pela verificação de segurança do site;
 * quando a nota aparece, a página é lida e devolvida ao app.
 */
public class NfceBrowserActivity extends Activity {

    public static final String EXTRA_URL = "url";
    public static final String EXTRA_KEY = "key";
    static String resultHtml;

    private static final String DETECT_JS =
        "(function(){var t=document.body?document.body.innerText:'';" +
        "return /Vl\\.?\\s*Unit/i.test(t)&&/(C[óo]digo|Qtde)/i.test(t)?document.documentElement.outerHTML:'';})()";

    private final Handler handler = new Handler(Looper.getMainLooper());
    private WebView web;
    private TextView hint;
    private boolean done;

    private final Runnable poll = new Runnable() {
        @Override
        public void run() {
            check();
            if (!done) handler.postDelayed(this, 1200);
        }
    };

    private int dp(int v) {
        return (int) TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics());
    }

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        resultHtml = null;
        String url = getIntent().getStringExtra(EXTRA_URL);
        String key = getIntent().getStringExtra(EXTRA_KEY);
        getWindow().setStatusBarColor(Color.parseColor("#0B1220"));

        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setBackgroundColor(Color.parseColor("#0B1220"));

        LinearLayout bar = new LinearLayout(this);
        bar.setOrientation(LinearLayout.HORIZONTAL);
        bar.setGravity(Gravity.CENTER_VERTICAL);
        bar.setPadding(dp(16), dp(10), dp(8), dp(10));

        LinearLayout texts = new LinearLayout(this);
        texts.setOrientation(LinearLayout.VERTICAL);
        TextView title = new TextView(this);
        title.setText("Nota fiscal na Fazenda");
        title.setTextColor(Color.parseColor("#F7F9FC"));
        title.setTextSize(TypedValue.COMPLEX_UNIT_SP, 17);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        hint = new TextView(this);
        hint.setTextColor(Color.parseColor("#94A3B8"));
        hint.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        hint.setText(key != null && !key.isEmpty()
            ? "Passe pela verificação e cole a chave (já copiada) no campo da consulta. O app lê a nota quando ela aparecer."
            : "Se o site pedir, passe pela verificação de segurança. O app lê a nota quando ela aparecer.");
        texts.addView(title);
        texts.addView(hint);
        bar.addView(texts, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));

        Button cancel = new Button(this);
        cancel.setText("Cancelar");
        cancel.setAllCaps(false);
        cancel.setTextColor(Color.parseColor("#A3E635"));
        cancel.setBackgroundColor(Color.TRANSPARENT);
        cancel.setOnClickListener(v -> finishWith(false));
        bar.addView(cancel);
        root.addView(bar);

        ProgressBar progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progress.setMax(100);
        progress.setIndeterminate(false);
        root.addView(progress, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(3)));

        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setSupportMultipleWindows(false);
        web.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageFinished(WebView view, String u) {
                check();
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onProgressChanged(WebView view, int p) {
                progress.setProgress(p);
                progress.setVisibility(p >= 100 ? View.INVISIBLE : View.VISIBLE);
            }
        });
        root.addView(web, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));
        setContentView(root);

        if (url == null || !url.startsWith("https://")) {
            finishWith(false);
            return;
        }
        web.loadUrl(url);
        handler.postDelayed(poll, 1500);
    }

    private void check() {
        if (done || web == null) return;
        web.evaluateJavascript(DETECT_JS, value -> {
            if (done || value == null || value.equals("null") || value.equals("\"\"")) return;
            try {
                String html = new JSONArray("[" + value + "]").getString(0);
                if (html.isEmpty()) return;
                resultHtml = html;
                finishWith(true);
            } catch (Exception ignored) {
            }
        });
    }

    private void finishWith(boolean ok) {
        if (done) return;
        done = true;
        handler.removeCallbacks(poll);
        setResult(ok ? RESULT_OK : RESULT_CANCELED);
        finish();
    }

    @Override
    public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack();
        else finishWith(false);
    }

    @Override
    protected void onDestroy() {
        handler.removeCallbacks(poll);
        if (web != null) {
            web.stopLoading();
            web.destroy();
        }
        super.onDestroy();
    }
}
