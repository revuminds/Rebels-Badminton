package com.rebels.badminton;

import android.app.Activity;
import android.app.ActivityManager;
import android.app.KeyguardManager;
import android.content.ContentValues;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Matrix;
import android.media.ExifInterface;
import android.net.Uri;
import android.os.PowerManager;
import android.provider.MediaStore;
import android.util.Base64;
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

    private PowerManager.WakeLock wake;

    /** v12: while pinned the screen must stay bright (HyperOS can ignore FLAG_KEEP_SCREEN_ON alone). */
    @SuppressWarnings("deprecation")
    private void keepAwake(boolean on) {
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        web.setKeepScreenOn(true);
        try {
            if (on) {
                if (wake == null) {
                    PowerManager pm = (PowerManager) getSystemService(POWER_SERVICE);
                    wake = pm.newWakeLock(PowerManager.SCREEN_BRIGHT_WAKE_LOCK | PowerManager.ON_AFTER_RELEASE, "rebels:pinned");
                    wake.setReferenceCounted(false);
                }
                if (!wake.isHeld()) wake.acquire();
            } else if (wake != null && wake.isHeld()) wake.release();
        } catch (Exception ignored) { }
    }

    @Override protected void onResume() { super.onResume(); keepAwake(isPinnedNow()); }
    @Override protected void onDestroy() { keepAwake(false); super.onDestroy(); }

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

    private static final int REQ_CRED = 41, REQ_SAVE = 42, REQ_OPEN = 43, REQ_GAL = 44, REQ_CAM = 45;
    private Uri camUri;

    /** v12 player photo: decode, fix rotation, shrink to ≤800 px and hand a JPEG data URL to the page (the page crops it small). */
    private void sendPhoto(Uri u, Bitmap thumb) {
        String js = "''";
        try {
            Bitmap b = thumb;
            int rot = 0;
            if (u != null) {
                BitmapFactory.Options o = new BitmapFactory.Options(); o.inJustDecodeBounds = true;
                try (InputStream in = getContentResolver().openInputStream(u)) { BitmapFactory.decodeStream(in, null, o); }
                int ss = 1; while (Math.max(o.outWidth, o.outHeight) / (ss * 2) >= 800) ss *= 2;
                BitmapFactory.Options o2 = new BitmapFactory.Options(); o2.inSampleSize = ss;
                try (InputStream in = getContentResolver().openInputStream(u)) { b = BitmapFactory.decodeStream(in, null, o2); }
                try (InputStream in = getContentResolver().openInputStream(u)) {
                    int ori = new ExifInterface(in).getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL);
                    rot = ori == ExifInterface.ORIENTATION_ROTATE_90 ? 90 : ori == ExifInterface.ORIENTATION_ROTATE_180 ? 180 : ori == ExifInterface.ORIENTATION_ROTATE_270 ? 270 : 0;
                } catch (Exception ignored) { }
            }
            if (b != null) {
                if (rot != 0) { Matrix m = new Matrix(); m.postRotate(rot); b = Bitmap.createBitmap(b, 0, 0, b.getWidth(), b.getHeight(), m, true); }
                ByteArrayOutputStream bo = new ByteArrayOutputStream();
                b.compress(Bitmap.CompressFormat.JPEG, 85, bo);
                js = JSONObject.quote("data:image/jpeg;base64," + Base64.encodeToString(bo.toByteArray(), Base64.NO_WRAP));
            }
        } catch (Exception ignored) { }
        web.evaluateJavascript("window.__photo&&__photo(" + js + ")", null);
    }

    private void dropCamUri() {
        if (camUri != null) { try { getContentResolver().delete(camUri, null, null); } catch (Exception ignored) { } camUri = null; }
    }
    private String pendingText;

    private boolean isPinnedNow() {
        ActivityManager am = (ActivityManager) getSystemService(ACTIVITY_SERVICE);
        return am.getLockTaskModeState() != ActivityManager.LOCK_TASK_MODE_NONE;
    }

    private void unpinNow() {
        try { stopLockTask(); } catch (Exception ignored) { }
        keepAwake(false);
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
        if (req == REQ_GAL && res == RESULT_OK && data != null && data.getData() != null) sendPhoto(data.getData(), null);
        if (req == REQ_CAM) {
            if (res == RESULT_OK) {
                Bitmap th = null;
                try { if (data != null && data.getExtras() != null) th = (Bitmap) data.getExtras().get("data"); } catch (Exception ignored) { }
                sendPhoto(camUri, th);
            }
            dropCamUri();
        }
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
        @JavascriptInterface public void pinScreen() { runOnUiThread(() -> { try { startLockTask(); } catch (Exception ignored) { } keepAwake(true); }); }

        /** Player photo: "cam" = camera app, else gallery. */
        @JavascriptInterface public void photo(String mode) {
            runOnUiThread(() -> {
                try {
                    if ("cam".equals(mode)) {
                        Intent i = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
                        dropCamUri();
                        try {
                            ContentValues cv = new ContentValues();
                            cv.put(MediaStore.Images.Media.DISPLAY_NAME, "rebels-player-" + System.currentTimeMillis() + ".jpg");
                            cv.put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg");
                            camUri = getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, cv);
                        } catch (Exception e) { camUri = null; }
                        if (camUri != null) {
                            i.putExtra(MediaStore.EXTRA_OUTPUT, camUri);
                            i.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        }
                        startActivityForResult(i, REQ_CAM);
                    } else {
                        Intent i = new Intent(Intent.ACTION_GET_CONTENT);
                        i.addCategory(Intent.CATEGORY_OPENABLE);
                        i.setType("image/*");
                        startActivityForResult(i, REQ_GAL);
                    }
                } catch (Exception e) {
                    web.evaluateJavascript("window.__photo&&__photo('')", null);
                }
            });
        }
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
