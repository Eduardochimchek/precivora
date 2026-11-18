package app.precivora;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(SystemThemePlugin.class);
        registerPlugin(NfceBrowserPlugin.class);
        registerPlugin(LocationSettingsPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
