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
            Intent intent = new Intent(context, AddExpenseActivity.class);
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
            PendingIntent pendingIntent = PendingIntent.getActivity(context, 0, intent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

            RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.widget_add_expense);
            views.setOnClickPendingIntent(R.id.widget_layout_root, pendingIntent);
            // Wait, we need an id for the root in widget_add_expense.xml
            // Will add if needed, or set onclick on the entire root.

            appWidgetManager.updateAppWidget(appWidgetId, views);
        }
    }
}
