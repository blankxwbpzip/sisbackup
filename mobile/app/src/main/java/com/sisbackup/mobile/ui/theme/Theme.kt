package com.sisbackup.mobile.ui.theme

import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// ─── Brand Colors ─────────────────────────────────────────

val Primary = Color(0xFF2563EB)       // Blue-600
val PrimaryDark = Color(0xFF1E40AF)   // Blue-800
val PrimaryLight = Color(0xFFDBEAFE)  // Blue-100
val Secondary = Color(0xFF10B981)     // Emerald-500
val Error = Color(0xFFEF4444)         // Red-500
val Warning = Color(0xFFF59E0B)       // Amber-500
val Surface = Color(0xFFF8FAFC)       // Slate-50
val Background = Color(0xFFFFFFFF)

private val LightColorScheme = lightColorScheme(
    primary = Primary,
    onPrimary = Color.White,
    primaryContainer = PrimaryLight,
    secondary = Secondary,
    error = Error,
    background = Background,
    surface = Surface,
    onBackground = Color(0xFF1E293B),
    onSurface = Color(0xFF334155),
)

@Composable
fun SisbackupTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = LightColorScheme,
        typography = Typography(),
        content = content
    )
}
