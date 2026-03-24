package com.expensetracker.app;

import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.widget.ArrayAdapter;
import android.widget.Button;
import android.widget.EditText;
import android.widget.Spinner;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Date;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

public class AddExpenseActivity extends Activity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        setContentView(R.layout.activity_add_expense);

        EditText editAmount = findViewById(R.id.editAmount);
        EditText editDescription = findViewById(R.id.editDescription);
        EditText editRemark = findViewById(R.id.editRemark);
        Spinner spinnerCategory = findViewById(R.id.spinnerCategory);
        Spinner spinnerPaymentMode = findViewById(R.id.spinnerPaymentMode);
        Button btnAdd = findViewById(R.id.btnAdd);
        Button btnCancel = findViewById(R.id.btnCancel);

        // Load Categories
        SharedPreferences prefs = getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
        String savedCats = prefs.getString("categories", "");
        List<String> categoriesList = new ArrayList<>();
        
        if (savedCats != null && !savedCats.isEmpty()) {
            try {
                JSONArray catArr = new JSONArray(savedCats);
                for (int i = 0; i < catArr.length(); i++) {
                    categoriesList.add(catArr.getString(i));
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        }

        if (categoriesList.isEmpty()) {
            categoriesList.addAll(Arrays.asList(
                "Food & Dining", "Transportation", "Shopping", "Entertainment", 
                "Bills & Utilities", "Health", "Travel", "Other"
            ));
        }

        ArrayAdapter<String> adapter = new ArrayAdapter<>(this, android.R.layout.simple_spinner_item, categoriesList);
        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        spinnerCategory.setAdapter(adapter);

        // Load Banks for Payment Mode
        String savedBanks = prefs.getString("banks", "[]");
        final List<String> banksList = new ArrayList<>();
        final List<String> bankIds = new ArrayList<>();
        banksList.add("Cash");
        bankIds.add("cash");
        
        try {
            JSONArray bankArr = new JSONArray(savedBanks);
            for (int i = 0; i < bankArr.length(); i++) {
                JSONObject bObj = bankArr.getJSONObject(i);
                banksList.add(bObj.getString("name"));
                bankIds.add(bObj.getString("id"));
            }
        } catch (Exception e) {
            e.printStackTrace();
        }

        ArrayAdapter<String> payAdapter = new ArrayAdapter<>(this, android.R.layout.simple_spinner_item, banksList);
        payAdapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item);
        spinnerPaymentMode.setAdapter(payAdapter);

        btnCancel.setOnClickListener(v -> finish());

        btnAdd.setOnClickListener(v -> {
            String amountStr = editAmount.getText().toString();
            String description = editDescription.getText().toString();

            if (amountStr.isEmpty() || description.isEmpty()) {
                Toast.makeText(this, "Please enter all fields", Toast.LENGTH_SHORT).show();
                return;
            }

            try {
                double amount = Double.parseDouble(amountStr);
                String selectedCategory = spinnerCategory.getSelectedItem().toString();

                SharedPreferences sPrefs = getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
                String expensesJsonStr = sPrefs.getString("expenses", "[]");
                JSONArray expensesArray = new JSONArray(expensesJsonStr);

                SimpleDateFormat dateFormat = new SimpleDateFormat("yyyy-MM-dd", Locale.getDefault());
                SimpleDateFormat timeFormat = new SimpleDateFormat("HH:mm", Locale.getDefault());
                Date now = new Date();

                JSONObject newExpense = new JSONObject();
                newExpense.put("id", UUID.randomUUID().toString());
                newExpense.put("amount", amount);
                newExpense.put("description", description);
                newExpense.put("category", selectedCategory);
                
                String selectedPayMode = spinnerPaymentMode.getSelectedItem().toString();
                String selectedPayModeId = bankIds.get(spinnerPaymentMode.getSelectedItemPosition());
                String remark = editRemark.getText().toString();
                
                newExpense.put("paymentMode", selectedPayMode);
                newExpense.put("remark", remark);
                newExpense.put("date", dateFormat.format(now));
                newExpense.put("time", timeFormat.format(now));

                expensesArray.put(newExpense);
                sPrefs.edit().putString("expenses", expensesArray.toString()).apply();

                // Handle Bank Transaction for balance update
                if (!selectedPayModeId.equals("cash")) {
                    String trxsJsonStr = sPrefs.getString("bankTransactions", "[]");
                    JSONArray trxsArray = new JSONArray(trxsJsonStr);
                    
                    JSONObject newTrx = new JSONObject();
                    newTrx.put("id", System.currentTimeMillis() + "_out");
                    newTrx.put("bankId", selectedPayModeId);
                    newTrx.put("amount", amount);
                    newTrx.put("type", "out");
                    newTrx.put("description", description);
                    newTrx.put("category", selectedCategory);
                    newTrx.put("date", dateFormat.format(now));
                    newTrx.put("time", timeFormat.format(now));
                    
                    trxsArray.put(newTrx);
                    sPrefs.edit().putString("bankTransactions", trxsArray.toString()).apply();
                }

                Toast.makeText(this, "Expense Added!", Toast.LENGTH_SHORT).show();
                finish();

            } catch (Exception e) {
                e.printStackTrace();
                Toast.makeText(this, "Error adding expense", Toast.LENGTH_SHORT).show();
            }
        });
    }
}
