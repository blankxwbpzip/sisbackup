package com.sisbackup.mobile.ui.files

import android.app.Activity
import android.os.Bundle

/**
 * Activity to handle sisbackup://share deep links
 * When a user clicks a shared link, this opens the app to the file browser
 */
class ShareReceiverActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val data = intent?.data
        if (data != null) {
            val filePath = data.getQueryParameter("path")
            // Launch main activity with file path
            val mainIntent = android.content.Intent(this, com.sisbackup.mobile.MainActivity::class.java).apply {
                putExtra("navigate_to", "files")
                putExtra("file_path", filePath ?: "/")
                flags = android.content.Intent.FLAG_ACTIVITY_NEW_TASK or android.content.Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            startActivity(mainIntent)
        }

        finish()
    }
}
