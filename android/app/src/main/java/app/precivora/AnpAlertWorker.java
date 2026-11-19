package app.precivora;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.work.Worker;
import androidx.work.WorkerParameters;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.Charset;
import java.text.Normalizer;
import java.text.NumberFormat;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.json.JSONArray;
import org.json.JSONObject;

/** Confere o levantamento da ANP com o app fechado e avisa quando aparece preço menor que o menor que a pessoa tem. */
public class AnpAlertWorker extends Worker {

    static final String PREFS = "precivora_anp_alert";
    static final String KEY_CONFIG = "config";
    static final String KEY_NOTIFIED = "notified";
    static final String CHANNEL = "precos";
    static final String EXTRA_ROUTE = "precivora_route";

    private static final String[] URLS = {
        "https://www.gov.br/anp/pt-br/centrais-de-conteudo/dados-abertos/arquivos/shpc/qus/ultimas-4-semanas-gasolina-etanol.csv",
        "https://www.gov.br/anp/pt-br/centrais-de-conteudo/dados-abertos/arquivos/shpc/qus/ultimas-4-semanas-diesel-gnv.csv",
    };

    private static final Map<String, String> PRODUCTS = new HashMap<>();

    static {
        PRODUCTS.put("GASOLINA", "gasolina_comum");
        PRODUCTS.put("GASOLINA ADITIVADA", "gasolina_aditivada");
        PRODUCTS.put("ETANOL", "etanol");
        PRODUCTS.put("DIESEL", "diesel");
        PRODUCTS.put("DIESEL S10", "diesel_s10");
        PRODUCTS.put("GNV", "gnv");
    }

    private static final class Row {
        String uf, cityKey, city, name, fuel, date;
        double price;
    }

    public AnpAlertWorker(@NonNull Context context, @NonNull WorkerParameters params) {
        super(context, params);
    }

    static String key(String s) {
        String n = Normalizer.normalize(s == null ? "" : s, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        return n.toLowerCase(Locale.ROOT).replaceAll("\\s+", " ").trim();
    }

    private static String isoDate(String br) {
        String[] p = br.trim().split("/");
        return p.length == 3 && p[2].length() == 4 ? p[2] + "-" + p[1] + "-" + p[0] : null;
    }

    @NonNull
    @Override
    public Result doWork() {
        SharedPreferences prefs = getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        try {
            JSONObject cfg = new JSONObject(prefs.getString(KEY_CONFIG, "{}"));
            if (!cfg.optBoolean("enabled")) return Result.success();
            Set<String> cities = toSet(cfg.optJSONArray("cities"));
            Set<String> cnpjs = toSet(cfg.optJSONArray("cnpjs"));
            Set<String> fuels = toSet(cfg.optJSONArray("fuels"));
            JSONObject best = cfg.optJSONObject("best");
            JSONObject labels = cfg.optJSONObject("labels");
            String last = cfg.optString("lastCollection", "");
            String notified = prefs.getString(KEY_NOTIFIED, "");
            if (cities.isEmpty() || fuels.isEmpty() || best == null) return Result.success();

            List<Row> candidates = new ArrayList<>();
            Map<String, String> knownUf = new HashMap<>();
            Map<String, Set<String>> ufsByCity = new HashMap<>();
            for (String url : URLS) read(url, cities, cnpjs, fuels, last, candidates, knownUf, ufsByCity);

            String newest = "";
            Map<String, Row> lowest = new HashMap<>();
            for (Row r : candidates) {
                Set<String> ufs = ufsByCity.get(r.cityKey);
                if (ufs == null || (ufs.size() > 1 && !r.uf.equals(knownUf.get(r.cityKey)))) continue;
                if (r.date.compareTo(newest) > 0) newest = r.date;
                Row cur = lowest.get(r.fuel);
                if (cur == null || r.price < cur.price) lowest.put(r.fuel, r);
            }
            if (newest.isEmpty() || newest.compareTo(notified) <= 0) return Result.success();

            List<Row> wins = new ArrayList<>();
            for (Map.Entry<String, Row> e : lowest.entrySet()) {
                double b = best.optDouble(e.getKey(), Double.NaN);
                if (!Double.isNaN(b) && e.getValue().price < b - 0.0005) wins.add(e.getValue());
            }
            if (!wins.isEmpty()) notify(wins, best, labels, cfg.optJSONObject("cityNames"));
            prefs.edit().putString(KEY_NOTIFIED, newest).apply();
            return Result.success();
        } catch (Exception e) {
            return getRunAttemptCount() < 2 ? Result.retry() : Result.success();
        }
    }

    private static Set<String> toSet(JSONArray a) {
        Set<String> s = new HashSet<>();
        if (a != null) for (int i = 0; i < a.length(); i++) s.add(a.optString(i));
        return s;
    }

    private void read(String url, Set<String> cities, Set<String> cnpjs, Set<String> fuels, String last, List<Row> out, Map<String, String> knownUf, Map<String, Set<String>> ufsByCity) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(url).openConnection();
        c.setConnectTimeout(20000);
        c.setReadTimeout(60000);
        c.setRequestProperty("User-Agent", "Precivora/1.0 (app pessoal de comparacao de precos)");
        try (BufferedReader in = new BufferedReader(new InputStreamReader(c.getInputStream(), Charset.forName("windows-1252")))) {
            String head = in.readLine();
            if (head == null) return;
            String[] h = head.replace("ï»¿", "").replace("﻿", "").split(";", -1);
            int iUf = -1, iCity = -1, iName = -1, iCnpj = -1, iProduct = -1, iDate = -1, iPrice = -1;
            for (int i = 0; i < h.length; i++) {
                switch (key(h[i])) {
                    case "estado - sigla": iUf = i; break;
                    case "municipio": iCity = i; break;
                    case "revenda": iName = i; break;
                    case "cnpj da revenda": iCnpj = i; break;
                    case "produto": iProduct = i; break;
                    case "data da coleta": iDate = i; break;
                    case "valor de venda": iPrice = i; break;
                    default: break;
                }
            }
            if (iUf < 0 || iCity < 0 || iName < 0 || iCnpj < 0 || iProduct < 0 || iDate < 0 || iPrice < 0) throw new IllegalStateException("formato");
            int need = Math.max(iUf, Math.max(iCity, Math.max(iName, Math.max(iCnpj, Math.max(iProduct, Math.max(iDate, iPrice))))));
            String line;
            while ((line = in.readLine()) != null) {
                String[] col = line.split(";", -1);
                if (col.length <= need) continue;
                String ck = key(col[iCity]);
                if (!cities.contains(ck)) continue;
                String uf = col[iUf].trim().toUpperCase(Locale.ROOT);
                String cnpj = col[iCnpj].replaceAll("\\D", "");
                ufsByCity.computeIfAbsent(ck, k -> new HashSet<>()).add(uf);
                if (cnpjs.contains(cnpj)) knownUf.put(ck, uf);
                String fuel = PRODUCTS.get(col[iProduct].trim().toUpperCase(Locale.ROOT));
                String date = isoDate(col[iDate]);
                if (fuel == null || !fuels.contains(fuel) || date == null || date.compareTo(last) <= 0) continue;
                double price;
                try {
                    price = Double.parseDouble(col[iPrice].trim().replace(".", "").replace(',', '.'));
                } catch (NumberFormatException e) {
                    continue;
                }
                if (!(price > 0 && price < 100)) continue;
                Row r = new Row();
                r.uf = uf;
                r.cityKey = ck;
                r.city = col[iCity].trim();
                r.name = col[iName].trim();
                r.fuel = fuel;
                r.date = date;
                r.price = price;
                out.add(r);
            }
        } finally {
            c.disconnect();
        }
    }

    private static String stationName(String raw) {
        String s = raw.replaceAll("(?i)\\b(LTDA|EIRELI|EPP|ME|S/?A|S\\.A\\.?)\\b\\.?", "").replaceAll("\\s+", " ").trim();
        StringBuilder b = new StringBuilder();
        for (String w : s.toLowerCase(new Locale("pt", "BR")).split(" ")) {
            if (w.isEmpty()) continue;
            if (b.length() > 0) b.append(' ');
            b.append(w.length() <= 2 && b.length() > 0 ? w : Character.toUpperCase(w.charAt(0)) + w.substring(1));
        }
        return b.length() > 0 ? b.toString() : "Posto";
    }

    private void notify(List<Row> wins, JSONObject best, JSONObject labels, JSONObject cityNames) {
        Context ctx = getApplicationContext();
        NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            nm.createNotificationChannel(new NotificationChannel(CHANNEL, "Preços em queda", NotificationManager.IMPORTANCE_DEFAULT));
        }
        NumberFormat money = NumberFormat.getCurrencyInstance(new Locale("pt", "BR"));
        money.setMinimumFractionDigits(3);
        money.setMaximumFractionDigits(3);
        Row top = wins.get(0);
        for (Row r : wins) if (best.optDouble(r.fuel) - r.price > best.optDouble(top.fuel) - top.price) top = r;
        String label = labels != null ? labels.optString(top.fuel, top.fuel) : top.fuel;
        String title = label + " a " + money.format(top.price) + " em " + stationName(top.name);
        String date = top.date.substring(8, 10) + "/" + top.date.substring(5, 7);
        String text = "Menor que o seu menor preço (" + money.format(best.optDouble(top.fuel)) + "). Coleta da ANP de " + date + " em " + (cityNames != null ? cityNames.optString(top.cityKey, top.city) : top.city) + ".";
        if (wins.size() > 1) text += " E mais " + (wins.size() - 1) + " combustíve" + (wins.size() == 2 ? "l" : "is") + " com preço menor.";

        Intent open = new Intent(ctx, MainActivity.class);
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        open.putExtra(EXTRA_ROUTE, "/combustiveis?f=" + top.fuel + "&anp=1");
        PendingIntent pi = PendingIntent.getActivity(ctx, 7301, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        NotificationCompat.Builder n = new NotificationCompat.Builder(ctx, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat_precivora)
            .setColor(0xFF2563EB)
            .setContentTitle(title)
            .setContentText(text)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(text))
            .setContentIntent(pi)
            .setAutoCancel(true);
        try {
            NotificationManagerCompat.from(ctx).notify(7301, n.build());
        } catch (SecurityException ignored) {
            // sem permissão de notificação: nada a fazer
        }
    }
}
