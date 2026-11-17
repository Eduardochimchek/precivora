package app.precivora;

import android.content.res.Configuration;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** Informa ao app web se o Android está no modo escuro (o WebView nem sempre repassa isso ao CSS). */
@CapacitorPlugin(name = "SystemTheme")
public class SystemThemePlugin extends Plugin {

    private static JSObject state(Configuration config) {
        JSObject result = new JSObject();
        result.put("dark", (config.uiMode & Configuration.UI_MODE_NIGHT_MASK) == Configuration.UI_MODE_NIGHT_YES);
        return result;
    }

    @PluginMethod
    public void get(PluginCall call) {
        call.resolve(state(getContext().getResources().getConfiguration()));
    }

    @Override
    protected void handleOnConfigurationChanged(Configuration newConfig) {
        notifyListeners("change", state(newConfig));
    }
}
