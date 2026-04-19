package com.expensetracker.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;

public class AddExpenseWidget extends AppWidgetProvider {

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_add_expense);

            // 1. Add Expense Button
            Intent addIntent = new Intent(context, AddExpenseActivity.class);
            addIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
            PendingIntent addPendingIntent = PendingIntent.getActivity(context, 1, addIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            views.setOnClickPendingIntent(R.id.btn_add_expense, addPendingIntent);

            // 2. Switch Account Button
            // We create a special intent that will tell our app to logout/reset
            Intent switchIntent = new Intent(context, MainActivity.class);
            switchIntent.setAction("ACTION_SWITCH_ACCOUNT");
            switchIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
            PendingIntent switchPendingIntent = PendingIntent.getActivity(context, 2, switchIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
            views.setOnClickPendingIntent(R.id.btn_switch_account, switchPendingIntent);

            appWidgetManager.updateAppWidget(appWidgetId, views);
        }
    }
}
