package com.rebels.badminton;

import android.app.Activity;
import android.app.ActivityManager;
import android.app.KeyguardManager;
import android.hardware.biometrics.BiometricManager;
import android.hardware.biometrics.BiometricPrompt;
import android.os.Build;
import android.os.CancellationSignal;
import android.content.Intent;
import android.os.Bundle;
import android.print.PrintAttributes;
import android.print.PrintManager;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.InputStream;
import java.io.OutputStream;
import org.json.JSONObject;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;

public class MainActivity extends Activity {
    private WebView web;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        web = new WebView(this);
        web.setBackgroundColor(0xFF0B2440);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);          // localStorage = the app's data
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setTextZoom(100);
        web.setWebChromeClient(new WebChromeClient()); // confirm()/alert() dialogs
        web.addJavascriptInterface(new Bridge(), "Android");
        setContentView(web);
        hideBars();
        if (state != null) web.restoreState(state);
        else web.loadUrl("file:///android_asset/index.html");
    }

    private void hideBars() {
        web.setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
    }

    @Override public void onWindowFocusChanged(boolean f) { super.onWindowFocusChanged(f); if (f) hideBars(); }
    @Override protected void onSaveInstanceState(Bundle o) { super.onSaveInstanceState(o); web.saveState(o); }
    @Override protected void onPause() { super.onPause(); web.evaluateJavascript("window.dispatchEvent(new Event('pagehide'))", null); }
    // Back button never closes the app by accident (data is saved anyway).
    @Override public void onBackPressed() { moveTaskToBack(true); }

    private static final int REQ_CRED = 41, REQ_SAVE = 42, REQ_OPEN = 43;
    private String pendingText;

    private boolean isPinnedNow() {
        ActivityManager am = (ActivityManager) getSystemService(ACTIVITY_SERVICE);
        return am.getLockTaskModeState() != ActivityManager.LOCK_TASK_MODE_NONE;
    }

    private void unpinNow() {
        try { stopLockTask(); } catch (Exception ignored) { }
        web.postDelayed(() -> web.evaluateJavascript("window.__dl&&__dl()", null), 400);
    }

    /** Unlock: face/fingerprint if the tablet allows, otherwise the tablet's own PIN/pattern. */
    private void askToUnpin() {
        if (Build.VERSION.SDK_INT >= 28) {
            BiometricPrompt.Builder b = new BiometricPrompt.Builder(this).setTitle("Unlock tablet");
            if (Build.VERSION.SDK_INT >= 30) {
                b.setAllowedAuthenticators(BiometricManager.Authenticators.BIOMETRIC_WEAK
                        | BiometricManager.Authenticators.DEVICE_CREDENTIAL);
            } else {
                b.setDeviceCredentialAllowed(true);
            }
            b.build().authenticate(new CancellationSignal(), getMainExecutor(),
                    new BiometricPrompt.AuthenticationCallback() {
                        @Override public void onAuthenticationSucceeded(BiometricPrompt.AuthenticationResult r) { unpinNow(); }
                    });
            return;
        }
        KeyguardManager km = (KeyguardManager) getSystemService(KEYGUARD_SERVICE);
        Intent i = km.createConfirmDeviceCredentialIntent("Unlock tablet", null);
        if (i == null) unpinNow(); else startActivityForResult(i, REQ_CRED);
    }

    @Override protected void onActivityResult(int req, int res, Intent data) {
        super.onActivityResult(req, res, data);
        if (req == REQ_CRED && res == RESULT_OK) unpinNow();
        if (req == REQ_SAVE) {
            boolean ok = false;
            if (res == RESULT_OK && data != null && data.getData() != null && pendingText != null) {
                try (OutputStream o = getContentResolver().openOutputStream(data.getData(), "wt")) {
                    o.write(pendingText.getBytes(StandardCharsets.UTF_8)); ok = true;
                } catch (Exception ignored) { }
            }
            pendingText = null;
            web.evaluateJavascript("window.__saved&&__saved(" + ok + ")", null);
        }
        if (req == REQ_OPEN && res == RESULT_OK && data != null && data.getData() != null) {
            try (InputStream in = getContentResolver().openInputStream(data.getData())) {
                ByteArrayOutputStream b = new ByteArrayOutputStream();
                byte[] buf = new byte[65536]; int n;
                while ((n = in.read(buf)) > 0) b.write(buf, 0, n);
                String t = b.toString("UTF-8");
                web.evaluateJavascript("window.__imp&&__imp(" + JSONObject.quote(t) + ")", null);
            } catch (Exception e) {
                web.evaluateJavascript("window.__imp&&__imp('')", null);
            }
        }
    }

    /** Second copy of the data in app storage, used if WebView storage is ever empty. */
    class Bridge {
        private File f() { return new File(getFilesDir(), "rebels-data.json"); }

        @JavascriptInterface public void saveFile(String json) {
            try {
                File tmp = new File(getFilesDir(), "rebels-data.tmp");
                try (FileOutputStream o = new FileOutputStream(tmp)) { o.write(json.getBytes(StandardCharsets.UTF_8)); o.getFD().sync(); }
                tmp.renameTo(f());
            } catch (Exception ignored) { }
        }

        @JavascriptInterface public String loadFile() {
            try { return f().exists() ? new String(Files.readAllBytes(f().toPath()), StandardCharsets.UTF_8) : ""; }
            catch (Exception e) { return ""; }
        }

        /** Players tab lock button: Android screen pinning, screen stays on. */
        @JavascriptInterface public void pinScreen() { runOnUiThread(() -> { try { startLockTask(); } catch (Exception ignored) { } }); }
        @JavascriptInterface public boolean isPinned() { return isPinnedNow(); }
        @JavascriptInterface public void unlock() { runOnUiThread(() -> askToUnpin()); }

        /** Export PDF: opens Android's print screen, where "Save as PDF" makes the file to share. */
        @JavascriptInterface public void print(String title) {
            runOnUiThread(() -> {
                PrintManager pm = (PrintManager) getSystemService(PRINT_SERVICE);
                PrintAttributes a = new PrintAttributes.Builder()
                        .setMediaSize(PrintAttributes.MediaSize.ISO_A4.asLandscape()).build();
                pm.print(title, web.createPrintDocumentAdapter(title), a);
            });
        }

        /** Backup: Android "save as" screen (Downloads, Drive, ...). */
        @JavascriptInterface public void saveAs(String name, String text) {
            pendingText = text;
            Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
            i.addCategory(Intent.CATEGORY_OPENABLE);
            i.setType("text/plain");
            i.putExtra(Intent.EXTRA_TITLE, name);
            runOnUiThread(() -> startActivityForResult(i, REQ_SAVE));
        }

        /** Backup: pick a backup file; its text goes to the app, which asks to confirm. */
        @JavascriptInterface public void pickFile() {
            Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT);
            i.addCategory(Intent.CATEGORY_OPENABLE);
            i.setType("*/*");
            runOnUiThread(() -> startActivityForResult(i, REQ_OPEN));
        }
    }
}
