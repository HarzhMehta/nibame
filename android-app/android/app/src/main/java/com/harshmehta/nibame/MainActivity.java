package com.harshmehta.nibame;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class MainActivity extends BridgeActivity {
    private static final Pattern WEB_URL =
        Pattern.compile("https?://\\S+", Pattern.CASE_INSENSITIVE);

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        handleShareIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleShareIntent(intent);
    }

    @Override
    public void onBackPressed() {
        WebView webView = getBridge() == null ? null : getBridge().getWebView();
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
            return;
        }
        super.onBackPressed();
    }

    private void handleShareIntent(Intent intent) {
        if (intent == null || !Intent.ACTION_SEND.equals(intent.getAction())) {
            return;
        }
        if (intent.getType() == null || !intent.getType().startsWith("text/")) {
            return;
        }

        CharSequence sharedText = intent.getCharSequenceExtra(Intent.EXTRA_TEXT);
        String sharedUrl = extractUrl(sharedText == null ? "" : sharedText.toString());
        if (sharedUrl == null || getBridge() == null) {
            return;
        }

        Uri target = Uri.parse(BuildConfig.NIBAME_WEB_URL)
            .buildUpon()
            .appendPath("mobile-share")
            .appendQueryParameter("url", sharedUrl)
            .build();
        WebView webView = getBridge().getWebView();
        webView.post(() -> webView.loadUrl(target.toString()));
        intent.setAction(null);
    }

    private String extractUrl(String value) {
        Matcher matcher = WEB_URL.matcher(value.trim());
        if (!matcher.find()) {
            return null;
        }
        return matcher.group().replaceFirst("[),.;!?]+$", "");
    }
}
