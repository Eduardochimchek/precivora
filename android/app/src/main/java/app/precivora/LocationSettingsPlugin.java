package app.precivora;

import android.app.Activity;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.IntentSenderRequest;
import androidx.activity.result.contract.ActivityResultContracts;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.gms.common.api.ResolvableApiException;
import com.google.android.gms.location.LocationRequest;
import com.google.android.gms.location.LocationServices;
import com.google.android.gms.location.LocationSettingsRequest;
import com.google.android.gms.location.Priority;

/** Mostra a janela do Google que liga a localização do celular sem sair do app. */
@CapacitorPlugin(name = "LocationSettings")
public class LocationSettingsPlugin extends Plugin {

    private ActivityResultLauncher<IntentSenderRequest> launcher;
    private PluginCall pending;

    @Override
    public void load() {
        launcher = getActivity().registerForActivityResult(new ActivityResultContracts.StartIntentSenderForResult(), (result) -> {
            PluginCall call = pending;
            pending = null;
            if (call != null) finish(call, result.getResultCode() == Activity.RESULT_OK);
        });
    }

    private static void finish(PluginCall call, boolean enabled) {
        JSObject out = new JSObject();
        out.put("enabled", enabled);
        call.resolve(out);
    }

    @PluginMethod
    public void enable(PluginCall call) {
        if (pending != null) {
            finish(call, false);
            return;
        }
        LocationRequest request = new LocationRequest.Builder(Priority.PRIORITY_BALANCED_POWER_ACCURACY, 10_000).build();
        LocationSettingsRequest settings = new LocationSettingsRequest.Builder().addLocationRequest(request).setAlwaysShow(true).build();
        LocationServices.getSettingsClient(getActivity())
            .checkLocationSettings(settings)
            .addOnSuccessListener((r) -> finish(call, true))
            .addOnFailureListener((e) -> {
                if (!(e instanceof ResolvableApiException)) {
                    finish(call, false);
                    return;
                }
                try {
                    pending = call;
                    launcher.launch(new IntentSenderRequest.Builder(((ResolvableApiException) e).getResolution()).build());
                } catch (Exception ex) {
                    pending = null;
                    finish(call, false);
                }
            });
    }
}
