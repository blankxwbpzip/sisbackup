package com.sisbackup.mobile.ui.files

import android.content.Intent
import android.widget.Toast
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.sisbackup.mobile.api.*
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FileBrowserScreen(
    api: SiscloudApi,
    initialPath: String = "/"
) {
    val scope = rememberCoroutineScope()
    val context = LocalContext.current

    var currentPath by remember { mutableStateOf(initialPath) }
    var files by remember { mutableStateOf<List<FileEntry>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var searchQuery by remember { mutableStateOf("") }
    var isSearching by remember { mutableStateOf(false) }

    fun loadFiles(path: String) {
        scope.launch {
            isLoading = true
            try {
                val response = api.listFiles(path)
                files = response.files.sortedWith(
                    compareByDescending<FileEntry> { it.isDirectory }
                        .thenBy { it.name.lowercase() }
                )
                currentPath = path
            } catch (e: Exception) {
                Toast.makeText(context, "Gagal memuat file: ${e.message}", Toast.LENGTH_SHORT).show()
            }
            isLoading = false
        }
    }

    fun shareFile(path: String) {
        scope.launch {
            try {
                val response = api.createShareLink(ShareRequest(path, 24))
                val shareIntent = Intent(Intent.ACTION_SEND).apply {
                    type = "text/plain"
                    putExtra(Intent.EXTRA_TEXT, "File Sisbackup: ${response.shareUrl}")
                    putExtra(Intent.EXTRA_SUBJECT, "Shared file from Sisbackup")
                }
                context.startActivity(Intent.createChooser(shareIntent, "Bagikan file"))
            } catch (e: Exception) {
                Toast.makeText(context, "Gagal membuat link: ${e.message}", Toast.LENGTH_SHORT).show()
            }
        }
    }

    LaunchedEffect(currentPath) { loadFiles(currentPath) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("File Backup") },
                actions = {
                    IconButton(onClick = { isSearching = !isSearching }) {
                        Icon(Icons.Default.Search, "Cari")
                    }
                }
            )
        }
    ) { padding ->
        Column(
            modifier = Modifier.fillMaxSize().padding(padding)
        ) {
            // Search bar
            if (isSearching) {
                OutlinedTextField(
                    value = searchQuery,
                    onValueChange = { searchQuery = it },
                    placeholder = { Text("Cari file...") },
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 16.dp, vertical = 8.dp),
                    leadingIcon = { Icon(Icons.Default.Search, null) },
                    trailingIcon = {
                        if (searchQuery.isNotEmpty()) {
                            IconButton(onClick = {
                                searchQuery = ""
                                loadFiles(currentPath)
                            }) {
                                Icon(Icons.Default.Close, "Clear")
                            }
                        }
                    },
                    singleLine = true
                )

                if (searchQuery.isNotEmpty()) {
                    Button(
                        onClick = {
                            scope.launch {
                                try {
                                    val result = api.searchFiles(searchQuery)
                                    files = result.files
                                } catch (e: Exception) {
                                    Toast.makeText(context, e.message, Toast.LENGTH_SHORT).show()
                                }
                            }
                        },
                        modifier = Modifier.padding(horizontal = 16.dp)
                    ) {
                        Text("Cari")
                    }
                }
            }

            // Breadcrumb
            if (!isSearching) {
                Row(
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    TextButton(onClick = { loadFiles("/") }) {
                        Text("🏠 Root", style = MaterialTheme.typography.labelSmall)
                    }
                    currentPath.split("/").filter { it.isNotEmpty() }.forEachIndexed { index, segment ->
                        Text(" › ", style = MaterialTheme.typography.labelSmall)
                        TextButton(onClick = {
                            val path = "/" + currentPath.split("/").filter { it.isNotEmpty() }.take(index + 1).joinToString("/")
                            loadFiles(path)
                        }) {
                            Text(segment, style = MaterialTheme.typography.labelSmall)
                        }
                    }
                }
            }

            // Loading
            if (isLoading) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
                return@Column
            }

            // File List
            if (files.isEmpty()) {
                Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(
                            Icons.Default.FolderOpen,
                            contentDescription = null,
                            modifier = Modifier.size(64.dp),
                            tint = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.3f)
                        )
                        Text("Folder kosong", style = MaterialTheme.typography.bodyMedium)
                    }
                }
            } else {
                LazyColumn {
                    items(files) { file ->
                        ListItem(
                            headlineContent = {
                                Text(
                                    file.name,
                                    maxLines = 1,
                                    overflow = TextOverflow.Ellipsis
                                )
                            },
                            supportingContent = {
                                Text(
                                    if (file.isDirectory) "Folder"
                                    else "${formatFileSize(file.size)} · ${file.modifiedAt.take(10)}",
                                    style = MaterialTheme.typography.bodySmall
                                )
                            },
                            leadingContent = {
                                Icon(
                                    if (file.isDirectory) Icons.Default.Folder
                                    else fileIcon(file.name),
                                    contentDescription = null,
                                    tint = if (file.isDirectory)
                                        MaterialTheme.colorScheme.primary
                                    else
                                        MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
                                )
                            },
                            trailingContent = {
                                if (!file.isDirectory) {
                                    IconButton(onClick = { shareFile(file.path) }) {
                                        Icon(Icons.Default.Share, "Share", modifier = Modifier.size(20.dp))
                                    }
                                }
                            },
                            modifier = Modifier.clickable {
                                if (file.isDirectory) {
                                    val newPath = if (currentPath == "/") "/${file.name}"
                                    else "$currentPath/${file.name}"
                                    loadFiles(newPath)
                                }
                            }
                        )
                    }
                }
            }
        }
    }
}

private fun fileIcon(fileName: String) = when {
    fileName.endsWith(".pdf") -> Icons.Default.PictureAsPdf
    fileName.endsWith(".docx", ".doc") -> Icons.Default.Description
    fileName.endsWith(".xlsx", ".xls") -> Icons.Default.TableChart
    fileName.endsWith(".pptx", ".ppt") -> Icons.Default.Slideshow
    fileName.endsWith(".jpg", ".jpeg", ".png", ".gif", ".bmp") -> Icons.Default.Image
    fileName.endsWith(".mp4", ".mkv", ".avi") -> Icons.Default.VideoFile
    fileName.endsWith(".mp3", ".wav", ".flac") -> Icons.Default.AudioFile
    fileName.endsWith(".zip", ".rar", ".7z") -> Icons.Default.FolderZip
    else -> Icons.Default.InsertDriveFile
}

private fun formatFileSize(bytes: Long): String {
    val sizes = listOf("B", "KB", "MB", "GB", "TB")
    var size = bytes.toDouble()
    var unitIndex = 0
    while (size >= 1024 && unitIndex < sizes.size - 1) {
        size /= 1024
        unitIndex++
    }
    return "%.1f %s".format(size, sizes[unitIndex])
}
