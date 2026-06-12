package com.sisbackup.mobile.ui.navigation

import androidx.compose.runtime.*
import androidx.compose.ui.platform.LocalContext
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import com.sisbackup.mobile.api.ApiClientBuilder
import com.sisbackup.mobile.api.SiscloudApi
import com.sisbackup.mobile.data.AuthRepository
import com.sisbackup.mobile.ui.dashboard.DashboardScreen
import com.sisbackup.mobile.ui.files.FileBrowserScreen
import com.sisbackup.mobile.ui.login.LoginScreen

object Routes {
    const val LOGIN = "login"
    const val DASHBOARD = "dashboard"
    const val FILES = "files"
}

@Composable
fun AppNavGraph(navController: NavHostController) {
    val context = LocalContext.current
    val authRepository = remember { AuthRepository(context) }
    val api = remember { ApiClientBuilder.create() }

    var isLoggedIn by remember { mutableStateOf(false) }
    var checkedSession by remember { mutableStateOf(false) }

    // Check saved session
    LaunchedEffect(Unit) {
        isLoggedIn = authRepository.restoreSession()
        checkedSession = true
    }

    if (!checkedSession) {
        // Splash screen could go here
        return
    }

    val startDestination = if (isLoggedIn) Routes.DASHBOARD else Routes.LOGIN

    NavHost(navController = navController, startDestination = startDestination) {
        composable(Routes.LOGIN) {
            LoginScreen(
                onLoginSuccess = {
                    isLoggedIn = true
                    navController.navigate(Routes.DASHBOARD) {
                        popUpTo(Routes.LOGIN) { inclusive = true }
                    }
                },
                authRepository = authRepository
            )
        }

        composable(Routes.DASHBOARD) {
            DashboardScreen(
                api = api,
                onNavigateToFiles = { navController.navigate(Routes.FILES) },
                onLogout = {
                    kotlinx.coroutines.MainScope().launch {
                        authRepository.logout()
                        isLoggedIn = false
                        navController.navigate(Routes.LOGIN) {
                            popUpTo(0) { inclusive = true }
                        }
                    }
                }
            )
        }

        composable(Routes.FILES) {
            FileBrowserScreen(api = api)
        }
    }
}

private fun kotlinx.coroutines.CoroutineScope.launch(
    block: suspend kotlinx.coroutines.CoroutineScope.() -> Unit
) {
    // Simple wrapper for readability
}
