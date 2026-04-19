package com.expensetracker.app;

import android.app.Activity;
import android.content.Context;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.widget.AdapterView;
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

    private final List<String> accountNames = new ArrayList<>();
    private final List<String> accountIds = new ArrayList<>();
    private final List<String> originalBankNames = new ArrayList<>();
    private final List<String> bankIds = new ArrayList<>();
    private final List<String> categoriesList = new ArrayList<>();

    private Spinner spinnerAccount;
    private Spinner spinnerCategory;
    private Spinner spinnerPaymentMode;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        setContentView(R.layout.activity_add_expense);

        EditText editAmount = findViewById(R.id.editAmount);
        EditText editDescription = findViewById(R.id.editDescription);
        EditText editRemark = findViewById(R.id.editRemark);
        spinnerAccount = findViewById(R.id.spinnerAccount);
        spinnerCategory = findViewById(R.id.spinnerCategory);
        spinnerPaymentMode = findViewById(R.id.spinnerPaymentMode);
        Button btnAdd = findViewById(R.id.btnAdd);
        Button btnCancel = findViewById(R.id.btnCancel);

        SharedPreferences prefs = getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);

        // 1. Load All Accounts
        String savedAccounts = prefs.getString("global_accounts", "[]");
        String lastAccountId = prefs.getString("last_account_id", "");
        int initialAccountPosition = 0;

        try {
            JSONArray accArr = new JSONArray(savedAccounts);
            for (int i = 0; i < accArr.length(); i++) {
                JSONObject accObj = accArr.getJSONObject(i);
                String id = accObj.getString("id");
                String name = accObj.getString("name");
                accountNames.add(name);
                accountIds.add(id);
                if (id.equals(lastAccountId)) {
                    initialAccountPosition = i;
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }

        if (accountNames.isEmpty()) {
            accountNames.add("Default Account");
            accountIds.add("");
        }

        ArrayAdapter<String> accAdapter = new ArrayAdapter<>(this, R.layout.spinner_item, accountNames);
        accAdapter.setDropDownViewResource(R.layout.spinner_dropdown_item);
        spinnerAccount.setAdapter(accAdapter);
        spinnerAccount.setSelection(initialAccountPosition);

        // 2. Setup Account Change Listener
        spinnerAccount.setOnItemSelectedListener(new AdapterView.OnItemSelectedListener() {
            @Override
            public void onItemSelected(AdapterView<?> parent, View view, int position, long id) {
                loadDataForAccount(accountIds.get(position));
            }
            @Override
            public void onNothingSelected(AdapterView<?> parent) {}
        });

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
                String selectedAccountId = accountIds.get(spinnerAccount.getSelectedItemPosition());
                String keyPrefix = selectedAccountId.isEmpty() ? "" : "account_" + selectedAccountId + "_";

                SharedPreferences sPrefs = getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
                String expensesJsonStr = sPrefs.getString(keyPrefix + "expenses", "[]");
                JSONArray expensesArray = new JSONArray(expensesJsonStr);

                SimpleDateFormat dateFormat = new SimpleDateFormat("yyyy-MM-dd", Locale.getDefault());
                SimpleDateFormat timeFormat = new SimpleDateFormat("HH:mm", Locale.getDefault());
                Date now = new Date();

                JSONObject newExpense = new JSONObject();
                newExpense.put("id", UUID.randomUUID().toString());
                newExpense.put("amount", amount);
                newExpense.put("description", description);
                newExpense.put("category", selectedCategory);
                
                String selectedPayMode = originalBankNames.get(spinnerPaymentMode.getSelectedItemPosition());
                String selectedPayModeId = bankIds.get(spinnerPaymentMode.getSelectedItemPosition());
                String remark = editRemark.getText().toString();
                
                newExpense.put("paymentMode", selectedPayMode);
                newExpense.put("remark", remark);
                newExpense.put("date", dateFormat.format(now));
                newExpense.put("time", timeFormat.format(now));

                expensesArray.put(newExpense);
                sPrefs.edit().putString(keyPrefix + "expenses", expensesArray.toString()).apply();

                if (!selectedPayModeId.equals("cash")) {
                    String trxsJsonStr = sPrefs.getString(keyPrefix + "bankTransactions", "[]");
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
                    sPrefs.edit().putString(keyPrefix + "bankTransactions", trxsArray.toString()).apply();
                }

                Toast.makeText(this, "Expense Added!", Toast.LENGTH_SHORT).show();
                finish();

            } catch (Exception e) {
                e.printStackTrace();
                Toast.makeText(this, "Error adding expense", Toast.LENGTH_SHORT).show();
            }
        });
    }

    private void loadDataForAccount(String accountId) {
        SharedPreferences prefs = getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
        String keyPrefix = accountId.isEmpty() ? "" : "account_" + accountId + "_";

        // Load Categories
        categoriesList.clear();
        String savedCats = prefs.getString(keyPrefix + "categories", "");
        if (savedCats != null && !savedCats.isEmpty()) {
            try {
                JSONArray catArr = new JSONArray(savedCats);
                for (int i = 0; i < catArr.length(); i++) {
                    categoriesList.add(catArr.getString(i));
                }
            } catch (Exception e) { e.printStackTrace(); }
        }
        if (categoriesList.isEmpty()) {
            categoriesList.addAll(Arrays.asList("Food & Dining", "Transportation", "Shopping", "Entertainment", "Bills & Utilities", "Health", "Travel", "Other"));
        }
        ArrayAdapter<String> catAdapter = new ArrayAdapter<>(this, R.layout.spinner_item, categoriesList);
        catAdapter.setDropDownViewResource(R.layout.spinner_dropdown_item);
        spinnerCategory.setAdapter(catAdapter);

        // Load Banks
        banksListClear();
        String savedBanks = prefs.getString(keyPrefix + "banks", "[]");
        banksListAdd("Cash", "Cash", "cash");
        try {
            JSONArray bankArr = new JSONArray(savedBanks);
            for (int i = 0; i < bankArr.length(); i++) {
                JSONObject bObj = bankArr.getJSONObject(i);
                String name = bObj.getString("name");
                double balance = bObj.optDouble("balance", 0.0);
                banksListAdd(name + " (₹" + String.format("%.2f", balance) + ")", name, bObj.getString("id"));
            }
        } catch (Exception e) { e.printStackTrace(); }

        ArrayAdapter<String> payAdapter = new ArrayAdapter<>(this, R.layout.spinner_item, displayBanksList);
        payAdapter.setDropDownViewResource(R.layout.spinner_dropdown_item);
        spinnerPaymentMode.setAdapter(payAdapter);
    }

    private final List<String> displayBanksList = new ArrayList<>();
    private void banksListClear() {
        displayBanksList.clear();
        originalBankNames.clear();
        bankIds.clear();
    }
    private void banksListAdd(String display, String original, String id) {
        displayBanksList.add(display);
        originalBankNames.add(original);
        bankIds.add(id);
    }
}
