package com.fenerkoyu.fitil;

import android.graphics.Color;
import android.os.Bundle;
import androidx.activity.EdgeToEdge;
import androidx.activity.SystemBarStyle;
import com.getcapacitor.BridgeActivity;

/**
 * Fitil ana etkinliği. Eklentiler (AdMob, satın alma, App, SplashScreen)
 * capacitor.plugins.json'dan kendiliğinden yüklenir.
 */
public class MainActivity extends BridgeActivity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Kenardan kenara: Android 15+ zaten zorunlu kılar; 7-14'te de aynı
        // görünüm için Capacitor SystemBars belgesinin önerdiği çağrı
        // (insetsHandling 'native', docs/ANDROID.md §3). Saydam çubuklar,
        // koyu zemine açık renkli simgeler (SystemBars style 'DARK' ile aynı).
        EdgeToEdge.enable(this, SystemBarStyle.dark(Color.TRANSPARENT), SystemBarStyle.dark(Color.TRANSPARENT));
    }
}
