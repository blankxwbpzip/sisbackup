package com.sisbackup.mobile.api

import com.sisbackup.mobile.BuildConfig
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.*
import java.util.concurrent.TimeUnit

/**
 * Retrofit API client untuk Siscloud
 */
interface SiscloudApi {

    // ─── Auth ─────────────────────────────────────────

    @POST("api/auth/login")
    suspend fun login(@Body request: LoginRequest): LoginResponse

    @GET("api/auth/me")
    suspend fun getProfile(): UserProfile

    // ─── File Browser ─────────────────────────────────

    @GET("api/files")
    suspend fun listFiles(
        @Query("path") path: String = "/",
        @Query("sort") sort: String = "name"
    ): FileListResponse

    @GET("api/files/download")
    suspend fun getDownloadUrl(@Query("path") path: String): DownloadUrlResponse

    @GET("api/files/search")
    suspend fun searchFiles(@Query("q") query: String): FileListResponse

    // ─── Backup Status ────────────────────────────────

    @GET("api/stats/my")
    suspend fun getMyStats(): BackupStats

    @GET("api/sync/logs")
    suspend fun getSyncLogs(@Query("limit") limit: Int = 20): List<SyncLog>

    // ─── Sharing ──────────────────────────────────────

    @POST("api/files/share")
    suspend fun createShareLink(@Body request: ShareRequest): ShareLinkResponse

    // ─── Push Token ───────────────────────────────────

    @POST("api/notifications/register")
    suspend fun registerPushToken(@Body request: PushTokenRequest): GenericResponse
}

// ─── Request / Response Models ────────────────────────────

data class LoginRequest(
    val username: String,
    val password: String
)

data class LoginResponse(
    val token: String,
    val refreshToken: String,
    val user: UserProfile
)

data class UserProfile(
    val id: String,
    val username: String,
    val displayName: String,
    val role: String,
    val quotaBytes: Long,
    val usedBytes: Long
)

data class FileListResponse(
    val path: String,
    val files: List<FileEntry>,
    val totalCount: Int
)

data class FileEntry(
    val name: String,
    val path: String,
    val isDirectory: Boolean,
    val size: Long,
    val modifiedAt: String,
    val mimeType: String?
)

data class DownloadUrlResponse(
    val url: String,
    val expiresIn: Int
)

data class BackupStats(
    val username: String,
    val displayName: String,
    val quotaBytes: Long,
    val usedBytes: Long,
    val totalSyncs: Int,
    val successfulSyncs: Int,
    val lastSync: SyncLog?
)

data class SyncLog(
    val id: String,
    val status: String,
    val filesTotal: Int,
    val filesSynced: Int,
    val bytesTransfer: Long,
    val startedAt: String,
    val completedAt: String?
)

data class ShareRequest(
    val path: String,
    val expiresInHours: Int = 24,
    val password: String? = null
)

data class ShareLinkResponse(
    val shareUrl: String,
    val expiresAt: String
)

data class PushTokenRequest(
    val token: String,
    val platform: String = "android"
)

data class GenericResponse(
    val success: Boolean,
    val message: String? = null
)

// ─── API Client Builder ───────────────────────────────────

object ApiClientBuilder {

    private var authToken: String? = null

    fun setToken(token: String?) {
        authToken = token
    }

    fun getToken(): String? = authToken

    fun create(baseUrl: String = BuildConfig.SISCLOUD_BASE_URL): SiscloudApi {
        val logging = HttpLoggingInterceptor().apply {
            level = if (BuildConfig.DEBUG)
                HttpLoggingInterceptor.Level.BODY
            else
                HttpLoggingInterceptor.Level.NONE
        }

        val authInterceptor = Interceptor { chain ->
            val request = chain.request().newBuilder()
            authToken?.let { request.addHeader("Authorization", "Bearer $it") }
            chain.proceed(request.build())
        }

        val client = OkHttpClient.Builder()
            .addInterceptor(authInterceptor)
            .addInterceptor(logging)
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .build()

        return Retrofit.Builder()
            .baseUrl(baseUrl)
            .client(client)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(SiscloudApi::class.java)
    }
}
