package app.precivora;

import android.Manifest;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import androidx.work.Constraints;
import androidx.work.ExistingPeriodicWorkPolicy;
import androidx.work.ExistingWorkPolicy;
import androidx.work.NetworkType;
import androidx.work.OneTimeWorkRequest;
import androidx.work.PeriodicWorkRequest;
import androidx.work.WorkManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.Calendar;
import java.util.concurrent.TimeUnit;

/** Agenda a conferência diária da ANP (WorkManager) e entrega ao app a tela aberta pela notificação. */
@CapacitorPlugin(name = "AnpAlert", permissions = { @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS }) })
public class AnpAlertPlugin extends Plugin {

    private static final String WORK = "anp-alert";
    private static String pendingRoute;

    @Override
    public void load() {
        keepRoute(getActivity().getIntent());
    }

    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        keepRoute(intent);
    }

    private static void keepRoute(Intent intent) {
        if (intent == null) return;
        String r = intent.getStringExtra(AnpAlertWorker.EXTRA_ROUTE);
        if (r != null) {
            pendingRoute = r;
            intent.removeExtra(AnpAlertWorker.EXTRA_ROUTE);
        }
    }

    @PluginMethod
    public void takeRoute(PluginCall call) {
        JSObject out = new JSObject();
        out.put("route", pendingRoute);
        pendingRoute = null;
        call.resolve(out);
    }

    @PluginMethod
    public void configure(PluginCall call) {
        Context ctx = getContext();
        SharedPreferences prefs = ctx.getSharedPreferences(AnpAlertWorker.PREFS, Context.MODE_PRIVATE);
        JSObject cfg = call.getData();
        boolean enabled = cfg.optBoolean("enabled");
        int hour = cfg.optInt("hour", 8);
        boolean wifi = cfg.optBoolean("wifiOnly", true);
        String schedule = enabled ? hour + "|" + wifi : "";
        String oldSchedule = prefs.getString("schedule", "");
        prefs.edit().putString(AnpAlertWorker.KEY_CONFIG, cfg.toString()).putString("schedule", schedule).apply();

        WorkManager wm = WorkManager.getInstance(ctx);
        if (!enabled) {
            wm.cancelUniqueWork(WORK);
        } else if (!schedule.equals(oldSchedule)) {
            Calendar next = Calendar.getInstance();
            next.set(Calendar.HOUR_OF_DAY, hour);
            next.set(Calendar.MINUTE, 0);
            next.set(Calendar.SECOND, 0);
            if (next.getTimeInMillis() <= System.currentTimeMillis()) next.add(Calendar.DAY_OF_MONTH, 1);
            long delay = next.getTimeInMillis() - System.currentTimeMillis();
            PeriodicWorkRequest req = new PeriodicWorkRequest.Builder(AnpAlertWorker.class, 24, TimeUnit.HOURS)
                .setInitialDelay(delay, TimeUnit.MILLISECONDS)
                .setConstraints(constraints(wifi))
                .build();
            wm.enqueueUniquePeriodicWork(WORK, ExistingPeriodicWorkPolicy.CANCEL_AND_REENQUEUE, req);
        }
        call.resolve();
    }

    private static Constraints constraints(boolean wifi) {
        return new Constraints.Builder().setRequiredNetworkType(wifi ? NetworkType.UNMETERED : NetworkType.CONNECTED).build();
    }

    @PluginMethod
    public void checkNow(PluginCall call) {
        Context ctx = getContext();
        SharedPreferences prefs = ctx.getSharedPreferences(AnpAlertWorker.PREFS, Context.MODE_PRIVATE);
        if (call.getBoolean("resetNotified", false)) prefs.edit().remove(AnpAlertWorker.KEY_NOTIFIED).apply();
        OneTimeWorkRequest req = new OneTimeWorkRequest.Builder(AnpAlertWorker.class).setConstraints(constraints(false)).build();
        WorkManager.getInstance(ctx).enqueueUniqueWork(WORK + "-agora", ExistingWorkPolicy.REPLACE, req);
        call.resolve();
    }

    @PluginMethod
    public void notificationPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT < 33 || getPermissionState("notifications") == PermissionState.GRANTED) {
            resolveGranted(call, true);
        } else if (call.getBoolean("request", false)) {
            requestPermissionForAlias("notifications", call, "permissionDone");
        } else {
            resolveGranted(call, false);
        }
    }

    @PermissionCallback
    private void permissionDone(PluginCall call) {
        resolveGranted(call, getPermissionState("notifications") == PermissionState.GRANTED);
    }

    private static void resolveGranted(PluginCall call, boolean granted) {
        JSObject out = new JSObject();
        out.put("granted", granted);
        call.resolve(out);
    }
}
