package com.expensetracker.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Handle "Change Account" request from widget
        if ("ACTION_SWITCH_ACCOUNT".equals(getIntent().getAction())) {
            SharedPreferences prefs = getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
            prefs.edit().remove("last_account_id").apply();
        }
    }
}
