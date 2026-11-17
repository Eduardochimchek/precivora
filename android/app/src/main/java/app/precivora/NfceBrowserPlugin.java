package app.precivora;

import android.content.Intent;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "NfceBrowser")
public class NfceBrowserPlugin extends Plugin {

    @PluginMethod
    public void open(PluginCall call) {
        String url = call.getString("url");
        if (url == null || !url.startsWith("https://")) {
            call.reject("Endereço inválido");
            return;
        }
        Intent intent = new Intent(getContext(), NfceBrowserActivity.class);
        intent.putExtra(NfceBrowserActivity.EXTRA_URL, url);
        intent.putExtra(NfceBrowserActivity.EXTRA_KEY, call.getString("key", ""));
        startActivityForResult(call, intent, "onResult");
    }

    @ActivityCallback
    private void onResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        String html = NfceBrowserActivity.resultHtml;
        NfceBrowserActivity.resultHtml = null;
        if (result.getResultCode() == android.app.Activity.RESULT_OK && html != null) {
            JSObject ret = new JSObject();
            ret.put("html", html);
            call.resolve(ret);
        } else {
            call.reject("cancelled", "CANCELLED");
        }
    }
}
