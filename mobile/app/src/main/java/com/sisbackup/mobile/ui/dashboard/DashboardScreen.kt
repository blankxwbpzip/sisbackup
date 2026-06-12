package com.sisbackup.mobile.ui.dashboard

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.sisbackup.mobile.api.BackupStats
import com.sisbackup.mobile.api.SiscloudApi
import kotlinx.coroutines.launch

@Composable
fun DashboardScreen(
    api: SiscloudApi,
    onNavigateToFiles: () -> Unit,
    onLogout: () -> Unit
) {
    val scope = rememberCoroutineScope()
    var stats by remember { mutableStateOf<BackupStats?>(null) }
    var isLoading by remember { mutableStateOf(true) }

    LaunchedEffect(Unit) {
        try {
            stats = api.getMyStats()
        } catch (_: Exception) {}
        isLoading = false
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Sisbackup") },
                actions = {
                    IconButton(onClick = onLogout) {
                        Icon(Icons.Default.Logout, "Logout")
                    }
                }
            )
        }
    ) { padding ->
        if (isLoading) {
            Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                CircularProgressIndicator()
            }
            return@Scaffold
        }

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp)
        ) {
            // Welcome
            Text(
                "Selamat datang, ${stats?.displayName ?: "..."}",
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold
            )

            Spacer(Modifier.height(20.dp))

            // Storage card
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)
            ) {
                Column(Modifier.padding(20.dp)) {
                    Text("Penyimpanan", style = MaterialTheme.typography.titleMedium)
                    Spacer(Modifier.height(8.dp))

                    stats?.let { s ->
                        val usedGb = s.usedBytes / (1024.0 * 1024.0 * 1024.0)
                        val quotaGb = s.quotaBytes / (1024.0 * 1024.0 * 1024.0)
                        val percent = if (s.quotaBytes > 0) (s.usedBytes.toFloat() / s.quotaBytes * 100) else 0f

                        Text(
                            "%.1f GB / %.1f GB".format(usedGb, quotaGb),
                            style = MaterialTheme.typography.bodyLarge
                        )

                        Spacer(Modifier.height(8.dp))

                        LinearProgressIndicator(
                            progress = { percent / 100f },
                            modifier = Modifier.fillMaxWidth(),
                            trackColor = MaterialTheme.colorScheme.surface,
                        )

                        Spacer(Modifier.height(4.dp))
                        Text("%.0f%% terpakai".format(percent), style = MaterialTheme.typography.bodySmall)
                    }
                }
            }

            Spacer(Modifier.height(16.dp))

            // Quick stats
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                StatCard(
                    icon = Icons.Default.Sync,
                    title = "Total Sync",
                    value = "${stats?.totalSyncs ?: 0}",
                    modifier = Modifier.weight(1f)
                )
                StatCard(
                    icon = Icons.Default.CheckCircle,
                    title = "Sukses",
                    value = "${stats?.successfulSyncs ?: 0}",
                    color = MaterialTheme.colorScheme.secondary,
                    modifier = Modifier.weight(1f)
                )
            }

            Spacer(Modifier.height(16.dp))

            // Quick actions
            Text("Aksi Cepat", style = MaterialTheme.typography.titleMedium)
            Spacer(Modifier.height(8.dp))

            OutlinedButton(
                onClick = onNavigateToFiles,
                modifier = Modifier.fillMaxWidth()
            ) {
                Icon(Icons.Default.Folder, null)
                Spacer(Modifier.width(8.dp))
                Text("Lihat File Backup")
            }

            Spacer(Modifier.height(8.dp))

            // Last sync info
            stats?.lastSync?.let { last ->
                Card(Modifier.fillMaxWidth()) {
                    Column(Modifier.padding(16.dp)) {
                        Text("Sync Terakhir", style = MaterialTheme.typography.labelMedium)
                        Text(
                            "${last.filesSynced}/${last.filesTotal} file · ${last.status}",
                            style = MaterialTheme.typography.bodySmall
                        )
                        Text(
                            last.startedAt.take(16).replace("T", " "),
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f)
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun StatCard(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    title: String,
    value: String,
    color: androidx.compose.ui.graphics.Color = MaterialTheme.colorScheme.primary,
    modifier: Modifier = Modifier
) {
    Card(modifier = modifier) {
        Column(
            Modifier.padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Icon(icon, null, tint = color, modifier = Modifier.size(28.dp))
            Spacer(Modifier.height(4.dp))
            Text(value, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
            Text(title, style = MaterialTheme.typography.bodySmall)
        }
    }
}
