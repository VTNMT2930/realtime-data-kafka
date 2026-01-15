<template>
  <div class="p-6">
    <!-- Header -->
    <div class="flex items-center justify-between mb-6">
      <div class="flex items-center space-x-3">
        <button @click="$router.push('/')" class="text-green-600 hover:text-green-800 transition">
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <h1 class="text-3xl font-bold">📥 Quản lý consumer</h1>
      </div>
      <button @click="fetchConsumerData"
        class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition flex items-center space-x-2">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        <span>Refresh</span>
      </button>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="flex justify-center items-center h-64">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
    </div>

    <div v-else>

      <!-- Summary Stats -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div class="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition">
          <div class="flex items-center justify-between mb-2">
            <p class="text-sm text-gray-600">Total Messages</p>
            <svg class="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 11l3 3m0 0l3-3m-3 3V8" />
            </svg>
          </div>
          <p class="text-3xl font-bold text-green-600">
            {{ formatNumber(statistics.totalMessages) }}
          </p>
        </div>

        <div class="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition">
          <div class="flex items-center justify-between mb-2">
            <p class="text-sm text-gray-600">Processed</p>
            <svg class="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p class="text-3xl font-bold text-blue-600">
            {{ formatNumber(statistics.processedMessages) }}
          </p>
        </div>

        <div class="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition">
          <div class="flex items-center justify-between mb-2">
            <p class="text-sm text-gray-600">Success Rate</p>
            <svg class="w-8 h-8 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <p class="text-3xl font-bold text-purple-600">{{ successRate }}%</p>
        </div>

        <div class="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition">
          <div class="flex items-center justify-between mb-2">
            <p class="text-sm text-gray-600">Failed Messages</p>
            <svg class="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p class="text-3xl font-bold text-red-600">
            {{ formatNumber(statistics.failedMessages) }}
          </p>
        </div>
      </div>

      <!-- Active Consumers - Sử dụng ConsumerList component -->
      <ConsumerList ref="consumerList" :consumerInstances="consumerInstances" @consumer-created="handleConsumerCreated"
        @start-stop-polling="handleStartStopPolling" @consumer-stopped="handleConsumerStopped"
        @consumer-resumed="handleConsumerResumed" @consumer-deleted="handleConsumerDeleted" />

      <!-- Statistics by Topic -->


      <!-- Consumer Logs (giống y hệt Producer Logs) -->
      <div class="bg-white rounded-lg shadow-md p-6">
        <h2 class="text-2xl font-bold mb-4 flex items-center">
          <svg class="w-6 h-6 mr-2 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Consumer Logs
        </h2>

        <!-- Search by ID -->
        <div class="mb-6 p-4 bg-gray-50 rounded-lg">
          <h3 class="text-lg font-semibold mb-3">🔍 Tìm Log theo ID</h3>
          <div class="flex gap-4">
            <input v-model="searchId" type="text" placeholder="Nhập Log ID..."
              class="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              @keyup.enter="searchLogById" />
            <button @click="searchLogById" :disabled="!searchId || searching"
              class="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition">
              {{ searching ? "Đang tìm..." : "Tìm kiếm" }}
            </button>
          </div>
        </div>

        <!-- All Logs Table -->
        <div class="mb-4 flex items-center justify-between">
          <h3 class="text-lg font-semibold">Tất cả Logs</h3>
          <div class="flex gap-4 items-center">
            <select v-model="filterStatus"
              class="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              @change="fetchAllLogs">
              <option value="">Tất cả trạng thái</option>
              <option value="RECEIVED">Received</option>
              <option value="PROCESSING">Processing</option>
              <option value="PROCESSED">Processed</option>
              <option value="FAILED">Failed</option>
            </select>
            <button @click="fetchAllLogs" :disabled="loadingLogs"
              class="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition">
              {{ loadingLogs ? "Đang tải..." : "Refresh" }}
            </button>
          </div>
        </div>

        <!-- Loading -->
        <div v-if="loadingLogs" class="flex justify-center items-center py-12">
          <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
        </div>

        <!-- Logs Table with Fixed Height and Scroll -->
        <div v-else class="border border-gray-200 rounded-lg overflow-hidden"
          style="height: 600px; display: flex; flex-direction: column;">
          <!-- Table Header - Fixed -->
          <div class="bg-gray-50 border-b border-gray-200">
            <table class="min-w-full table-fixed">
              <thead>
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" style="width: 15%;">ID
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" style="width: 12%;">Status
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" style="width: 12%;">Group
                    ID</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" style="width: 15%;">Topic
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" style="width: 10%;">
                    Partition</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" style="width: 15%;">
                    Consumer ID</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" style="width: 18%;">
                    Created</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" style="width: 10%;">
                    Actions</th>
                </tr>
              </thead>
            </table>
          </div>

          <!-- Table Body - Scrollable -->
          <div class="overflow-y-auto flex-1 bg-white">
            <table class="min-w-full table-fixed">
              <tbody class="divide-y divide-gray-200">
                <tr v-for="log in allLogs" :key="log.id" class="hover:bg-gray-50 transition">
                  <td class="px-6 py-4 text-sm font-mono text-gray-900 truncate" style="width: 15%;">
                    {{ log.id.substring(0, 8) }}...
                  </td>
                  <td class="px-6 py-4" style="width: 12%;">
                    <span class="px-2 py-1 text-xs rounded" :class="getStatusClass(log.status)">
                      {{ log.status }}
                    </span>
                  </td>
                  <td class="px-6 py-4 text-sm text-blue-600 font-medium truncate" style="width: 12%;">
                    {{ log.groupId || "-" }}
                  </td>
                  <td class="px-6 py-4 text-sm text-gray-900 truncate" style="width: 15%;">{{ log.topic || "N/A" }}</td>
                  <td class="px-6 py-4 text-sm text-gray-900" style="width: 10%;">{{ log.partition ?? "N/A" }}</td>
                  <td class="px-6 py-4 text-sm text-gray-500 truncate" style="width: 15%;">{{ log.consumerId || "-" }}
                  </td>
                  <td class="px-6 py-4 text-sm text-gray-500" style="width: 18%;">{{ formatDate(log.createdAt) }}</td>
                  <td class="px-6 py-4" style="width: 10%;">
                    <button @click="viewLogDetails(log.id)"
                      class="text-green-600 hover:text-green-800 text-sm font-medium">
                      View
                    </button>
                  </td>
                </tr>
                <tr v-if="!allLogs.length">
                  <td colspan="7" class="text-center py-12 text-gray-500">
                    Không có logs nào
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Pagination Info -->
        <div v-if="pagination" class="mt-4 text-sm text-gray-600 text-center">
          Hiển thị {{ allLogs.length }} / {{ pagination.total }} logs
          (Trang {{ pagination.page }} / {{ pagination.totalPages }})
        </div>

        <!-- Pagination Controls -->
        <div v-if="pagination && pagination.totalPages > 1" class="mt-4 flex items-center justify-center">
          <nav class="flex items-center space-x-2">
            <!-- Previous Button -->
            <button
              @click="goToPage(currentPage - 1)"
              :disabled="currentPage === 1"
              :class="[
                'flex items-center justify-center w-10 h-10 rounded-lg border transition-colors',
                currentPage === 1
                  ? 'border-gray-200 text-gray-300 cursor-not-allowed'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50',
              ]"
            >
              <svg
                class="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </button>

            <!-- Page Numbers -->
            <button
              v-for="page in visiblePages"
              :key="page"
              @click="goToPage(page)"
              :class="[
                'flex items-center justify-center w-10 h-10 rounded-lg text-sm font-medium transition-colors',
                page === currentPage
                  ? 'bg-green-600 text-white'
                  : 'border border-gray-300 text-gray-700 hover:bg-gray-50',
              ]"
            >
              {{ page }}
            </button>

            <!-- Next Button -->
            <button
              @click="goToPage(currentPage + 1)"
              :disabled="currentPage === pagination.totalPages"
              :class="[
                'flex items-center justify-center w-10 h-10 rounded-lg border transition-colors',
                currentPage === pagination.totalPages
                  ? 'border-gray-200 text-gray-300 cursor-not-allowed'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50',
              ]"
            >
              <svg
                class="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>
          </nav>
        </div>
      </div>

      <!-- Log Detail Modal -->
      <div v-if="selectedLog" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
        @click.self="closeLogDetail">
        <div class="bg-white rounded-lg shadow-xl max-w-5xl w-full max-h-[90vh] flex flex-col">
          <!-- Modal Header - Fixed -->
          <div class="bg-white border-b border-gray-200 p-6 flex items-center justify-between rounded-t-lg">
            <h3 class="text-2xl font-bold text-gray-800">
              📋 Chi tiết Consumer Log
            </h3>
            <button @click="closeLogDetail" class="text-gray-500 hover:text-gray-700 transition">
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Modal Body - Scrollable -->
          <div class="p-6 overflow-y-auto flex-1">
            <!-- Info Grid -->
            <div class="grid grid-cols-2 gap-4 mb-6">
              <div class="bg-gray-50 p-4 rounded-lg">
                <span class="text-xs font-medium text-gray-500 uppercase block mb-1">ID</span>
                <span class="text-sm font-mono text-gray-900 break-all">{{ selectedLog.id }}</span>
              </div>

              <div class="bg-gray-50 p-4 rounded-lg">
                <span class="text-xs font-medium text-gray-500 uppercase block mb-1">Original Log ID</span>
                <span class="text-sm font-mono text-gray-900 break-all">{{ selectedLog.originalLogId }}</span>
              </div>

              <div class="bg-gray-50 p-4 rounded-lg">
                <span class="text-xs font-medium text-gray-500 uppercase block mb-1">Status</span>
                <span class="inline-block px-3 py-1 rounded text-sm font-medium"
                  :class="getStatusClass(selectedLog.status)">
                  {{ selectedLog.status }}
                </span>
              </div>

              <div class="bg-gray-50 p-4 rounded-lg">
                <span class="text-xs font-medium text-gray-500 uppercase block mb-1">Topic</span>
                <span class="text-sm text-gray-900 font-medium">{{ selectedLog.topic || "N/A" }}</span>
              </div>

              <div class="bg-gray-50 p-4 rounded-lg">
                <span class="text-xs font-medium text-gray-500 uppercase block mb-1">Partition</span>
                <span class="text-sm text-gray-900">{{ selectedLog.partition ?? "N/A" }}</span>
              </div>

              <div class="bg-gray-50 p-4 rounded-lg">
                <span class="text-xs font-medium text-gray-500 uppercase block mb-1">Offset</span>
                <span class="text-sm text-gray-900">{{ selectedLog.offset || "N/A" }}</span>
              </div>

              <div class="bg-gray-50 p-4 rounded-lg col-span-2">
                <span class="text-xs font-medium text-gray-500 uppercase block mb-1">Consumer ID</span>
                <span class="text-sm text-gray-900 font-mono">{{ selectedLog.consumerId || "N/A" }}</span>
              </div>

              <div class="bg-gray-50 p-4 rounded-lg">
                <span class="text-xs font-medium text-gray-500 uppercase block mb-1">Created At</span>
                <span class="text-sm text-gray-900">{{ formatDate(selectedLog.createdAt) }}</span>
              </div>

              <div class="bg-gray-50 p-4 rounded-lg">
                <span class="text-xs font-medium text-gray-500 uppercase block mb-1">Updated At</span>
                <span class="text-sm text-gray-900">{{ formatDate(selectedLog.updatedAt) }}</span>
              </div>
            </div>

            <!-- Error Message -->
            <div v-if="selectedLog.errorMessage" class="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div class="flex items-start">
                <svg class="w-5 h-5 text-red-600 mt-0.5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                    clip-rule="evenodd" />
                </svg>
                <div>
                  <h4 class="text-sm font-medium text-red-800 mb-1">Error Message</h4>
                  <p class="text-sm text-red-700">{{ selectedLog.errorMessage }}</p>
                </div>
              </div>
            </div>

            <!-- Data Preview -->
            <div class="border border-gray-200 rounded-lg overflow-hidden">
              <div class="bg-gray-800 px-4 py-2 flex items-center justify-between">
                <span class="text-sm font-medium text-white">📄 Data Content</span>
                <button @click="copyToClipboard(formatLogData(selectedLog.parsedData))"
                  class="text-xs px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded transition">
                  Copy
                </button>
              </div>
              <pre class="p-4 bg-gray-900 text-green-400 overflow-auto text-xs leading-relaxed"
                style="max-height: 400px;">{{ formatLogData(selectedLog.parsedData) }}</pre>
            </div>
          </div>
        </div>
      </div>

      <!-- Auto Refresh Indicator -->
      <div class="mt-6 text-center text-sm">
        <span class="inline-flex items-center">
          <span class="flex h-2 w-2 mr-2">
            <span v-if="socketConnectionStatus === 'connected'"
              class="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-green-400 opacity-75"></span>
            <span :class="{
              'bg-green-500': socketConnectionStatus === 'connected',
              'bg-yellow-500': socketConnectionStatus === 'connecting',
              'bg-red-500': socketConnectionStatus === 'disconnected',
            }" class="relative inline-flex rounded-full h-2 w-2"></span>
          </span>
          <span :class="{
            'text-green-600': socketConnectionStatus === 'connected',
            'text-yellow-600': socketConnectionStatus === 'connecting',
            'text-red-600': socketConnectionStatus === 'disconnected',
          }" class="font-medium">
            WebSocket: {{ socketConnectionStatus }}
          </span>
          <span v-if="socketConnectionStatus === 'connected'" class="ml-2 text-gray-500">
            (Real-time updates)
          </span>
        </span>
      </div>
    </div>
  </div>
</template>

<script>
import { getConsumerStats, getConsumerLogs, getConsumerLogById } from "@/services/apiService";
import ConsumerList from "@/components/common/ConsumerList.vue";
import SystemStatus from "@/components/common/SystemStatus.vue";
import { io } from "socket.io-client";
import { useToast } from "@/composables/useToast";

export default {
  name: "ConsumerDashboardView",
  components: {
    ConsumerList,
    SystemStatus,
  },
  setup() {
    const toast = useToast();
    return { toast };
  },
  data() {
    return {
      loading: true,
      loadingLogs: false,
      statistics: {
        totalMessages: 0,
        processedMessages: 0,
        failedMessages: 0,
        activeConsumers: 0,
      },
      allLogs: [],
      pagination: null,
      currentPage: 1,
      itemsPerPage: 50,
      filterStatus: '',
      searchId: '',
      searching: false,
      selectedLog: null,
      consumerInstances: [],
      socket: null,
      socketConnectionStatus: "connecting", // connecting, connected, disconnected
      // ✅ Track polling intervals để có thể clear khi nhận WebSocket event
      pollingIntervals: new Map(), // consumerId -> intervalId
    };
  },
  computed: {
    successRate() {
      if (this.statistics.totalMessages === 0) return 0;
      return Math.round(
        (this.statistics.processedMessages / this.statistics.totalMessages) *
        100
      );
    },
    topicStats() {
      // Group logs by topic từ allLogs
      const grouped = {};
      this.allLogs.forEach((log) => {
        const topic = log.topic || "Unknown";
        if (!grouped[topic]) {
          grouped[topic] = {
            name: topic,
            total: 0,
            processed: 0,
            failed: 0,
            partitions: new Set(),
          };
        }
        grouped[topic].total++;
        if (log.status === "PROCESSED") grouped[topic].processed++;
        else if (log.status === "FAILED") grouped[topic].failed++;
        if (log.partition !== null && log.partition !== undefined) {
          grouped[topic].partitions.add(log.partition);
        }
      });

      return Object.values(grouped).map((topic) => ({
        ...topic,
        successRate:
          topic.total > 0
            ? Math.round((topic.processed / topic.total) * 100)
            : 0,
        partitions: topic.partitions.size,
      }));
    },
    // ✅ Visible pages for pagination (show max 5 pages)
    visiblePages() {
      if (!this.pagination) return [];
      
      const total = this.pagination.totalPages;
      const current = this.currentPage;
      const pages = [];

      if (total <= 5) {
        // Show all pages if total is 5 or less
        for (let i = 1; i <= total; i++) {
          pages.push(i);
        }
      } else {
        // Show current page and 2 pages before/after
        let start = Math.max(1, current - 2);
        let end = Math.min(total, current + 2);

        // Adjust if near the beginning or end
        if (current <= 3) {
          end = 5;
        } else if (current >= total - 2) {
          start = total - 4;
        }

        for (let i = start; i <= end; i++) {
          pages.push(i);
        }
      }

      return pages;
    },
  },
  watch: {
    // Reset to page 1 when filter changes
    filterStatus() {
      this.currentPage = 1;
      this.fetchAllLogs();
    },
  },
  async mounted() {
    // Chỉ load data lần đầu
    await this.fetchConsumerData();
    await this.fetchAllLogs();

    // Khởi tạo WebSocket để nhận realtime updates
    this.initializeWebSocket();
  },
  beforeUnmount() {
    // ✅ Clear tất cả polling intervals
    console.log(`🛑 Clearing ${this.pollingIntervals.size} polling interval(s)`);
    this.pollingIntervals.forEach((intervalId, consumerId) => {
      clearInterval(intervalId);
      console.log(`  - Cleared polling for ${consumerId}`);
    });
    this.pollingIntervals.clear();

    // Ngắt kết nối WebSocket khi rời khỏi trang
    if (this.socket) {
      this.socket.disconnect();
      console.log("WebSocket disconnected");
    }
  },
  methods: {
    // ✅ Khởi tạo WebSocket connection
    initializeWebSocket() {
      console.log("🔌 Initializing WebSocket connection...");

      // Kết nối đến Consumer Service (Port 3001)
      this.socket = io("http://localhost:3001", {
        transports: ["websocket", "polling"], // Ưu tiên websocket
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: Infinity, // Retry forever
        timeout: 20000, // 20 seconds timeout
        autoConnect: true,
      });

      // ✅ Sự kiện kết nối thành công
      this.socket.on("connect", () => {
        console.log("✅ WebSocket connected successfully!");
        console.log("Socket ID:", this.socket.id);
        this.socketConnectionStatus = "connected";
      });

      // ✅ Sự kiện connection-success từ server
      this.socket.on("connection-success", (data) => {
        console.log("📨 Connection success message:", data);
      });

      // ✅ Sự kiện connection error
      this.socket.on("connect_error", (error) => {
        console.error("❌ WebSocket connection error:", error);
        this.socketConnectionStatus = "disconnected";
      });

      // ✅ Sự kiện mất kết nối
      this.socket.on("disconnect", (reason) => {
        console.warn("❌ WebSocket disconnected:", reason);
        this.socketConnectionStatus = "disconnected";
      });

      // ✅ Sự kiện kết nối lại
      this.socket.on("reconnect", (attemptNumber) => {
        console.log(`🔄 WebSocket reconnected after ${attemptNumber} attempts`);
        this.socketConnectionStatus = "connected";
        // Refresh data sau khi reconnect
        this.fetchConsumerData();
      });

      // ✅ Sự kiện connection-success từ backend
      this.socket.on("connection-success", (data) => {
        console.log("🎉 Backend confirmed connection:", data);
      });

      // 🔥 REALTIME EVENTS - Nhận từ backend

      // 1. Khi nhận được message mới từ Kafka
      this.socket.on("message-received", (data) => {
        console.log("📨 Message received:", data);
        
        // Hiện toast thông báo
        this.toast.success(`📨 Đã nhận tin nhắn mới từ topic: ${data.topic}`);
        
        // Refresh logs để lấy log mới
        this.fetchAllLogs();
        // Tăng totalMessages
        this.statistics.totalMessages++;
      });

      // 2. Khi bắt đầu xử lý message
      this.socket.on("processing-started", (data) => {
        console.log("⚙️ Processing started:", data);
        // Update log trong danh sách nếu có
        const logIndex = this.allLogs.findIndex(log => log.originalLogId === data.logId);
        if (logIndex !== -1) {
          this.allLogs[logIndex].status = "PROCESSING";
        }
      });

      // 3. Khi xử lý thành công
      this.socket.on("processing-completed", (data) => {
        console.log("✅ Processing completed:", data);
        // Update log trong danh sách nếu có
        const logIndex = this.allLogs.findIndex(log => log.originalLogId === data.logId);
        if (logIndex !== -1) {
          this.allLogs[logIndex].status = "PROCESSED";
        }
        this.statistics.processedMessages++;
      });

      // 4. Khi xử lý thất bại
      this.socket.on("processing-failed", (data) => {
        console.log("❌ Processing failed:", data);
        // Update log trong danh sách nếu có
        const logIndex = this.allLogs.findIndex(log => log.originalLogId === data.logId);
        if (logIndex !== -1) {
          this.allLogs[logIndex].status = "FAILED";
        }
        this.statistics.failedMessages++;
      });

      // 5. Nhận toàn bộ stats update (tối ưu nhất)
      this.socket.on("stats-updated", (stats) => {
        console.log("📊 Stats updated:", stats);
        // Cập nhật toàn bộ statistics với Vue reactivity
        this.statistics = {
          totalMessages: stats.totalMessages ?? this.statistics.totalMessages,
          processedMessages:
            stats.processedMessages ?? this.statistics.processedMessages,
          failedMessages:
            stats.failedMessages ?? this.statistics.failedMessages,
          activeConsumers:
            stats.activeConsumers ?? this.statistics.activeConsumers,
        };
      });

      // 6. Khi consumer đang được tạo
      this.socket.on("consumer-creating", (data) => {
        console.log("⚙️ Consumer creating:", data);
        // Thêm consumer tạm thời với trạng thái "creating"
        this.addTemporaryConsumer(data.consumerId, "creating");
      });

      // 7. Khi consumer đã được tạo xong hoặc status changed
      this.socket.on("consumer-status-changed", (data) => {
        console.log("👥 Consumer status changed:", data);
        // Fetch lại consumer instances từ database
        this.refreshConsumerInstances();
      });

      // 7. Khi consumer được resumed
      this.socket.on("consumer-resumed", (data) => {
        console.log("▶️ Consumer resumed:", data);
        this.handleConsumerResumed(data.consumerId);
      });

      // 8. Khi consumer được stopped
      this.socket.on("consumer-stopped", (data) => {
        console.log("⏸️ Consumer stopped:", data);
        // Gọi confirmation method của ConsumerList để clear loading state
        if (this.$refs.consumerList) {
          this.$refs.consumerList.handleConsumerStoppedConfirmation(
            data.consumerId
          );
        }
        // Sau đó mới update local state
        this.handleConsumerStopped(data.consumerId);
      });

      // 9. Khi consumer được deleted
      this.socket.on("consumer-deleted", (data) => {
        console.log("🗑️ Consumer deleted:", data);
        // Gọi confirmation method của ConsumerList để clear loading state
        if (this.$refs.consumerList) {
          this.$refs.consumerList.handleConsumerDeletedConfirmation(
            data.consumerId
          );
        }
        // Sau đó mới update local state
        this.handleConsumerDeleted(data.consumerId);
      });
    },

    // ✅ Refresh consumer instances (lightweight)
    async refreshConsumerInstances() {
      try {
        const statsResponse = await getConsumerStats();
        if (statsResponse.success) {
          // Preserve temporary consumers (creating/stopping states)
          const temporaryConsumers = this.consumerInstances.filter(
            (c) => c.status === "creating" || c.status === "stopping"
          );

          // Normalize data từ database
          const dbConsumers = (statsResponse.instances || []).map(
            (instance) => ({
              ...instance,
              consumerId: instance.id || instance.consumerId,
              status: (instance.status || "").toLowerCase(),
            })
          );

          // Merge: DB consumers + temporary consumers (không trùng ID)
          const mergedConsumers = [...dbConsumers];
          temporaryConsumers.forEach((tempConsumer) => {
            const existsInDb = dbConsumers.find(
              (db) => db.consumerId === tempConsumer.consumerId
            );
            if (!existsInDb) {
              mergedConsumers.push(tempConsumer);
            }
          });

          this.consumerInstances = mergedConsumers;
          this.statistics.activeConsumers = statsResponse.activeConsumers || 0;

          console.log("📊 Merged consumers:", {
            database: dbConsumers.length,
            temporary: temporaryConsumers.length,
            total: mergedConsumers.length,
          });
        }
      } catch (error) {
        console.error("Error refreshing consumer instances:", error);
      }
    },

    // ✅ Thêm consumer tạm thời khi đang được tạo
    addTemporaryConsumer(consumerId, status) {
      // Kiểm tra xem consumer đã tồn tại chưa
      const existingIndex = this.consumerInstances.findIndex(
        (c) => c.consumerId === consumerId
      );

      const tempConsumer = {
        consumerId: consumerId,
        id: consumerId,
        status: status, // 'creating', 'stopping', etc.
        hostname: "N/A",
        port: 0,
        pid: 0,
        lastHeartbeat: new Date().toISOString(),
      };

      if (existingIndex >= 0) {
        // ✅ Cập nhật consumer hiện có - Dùng splice để trigger Vue reactivity
        const updatedConsumer = {
          ...this.consumerInstances[existingIndex],
          status: status,
        };
        this.consumerInstances.splice(existingIndex, 1, updatedConsumer);
      } else {
        // Thêm consumer mới tạm thời
        this.consumerInstances.push(tempConsumer);
      }

      console.log(
        `✅ Updated consumer ${consumerId} with status: ${status}`
      );

      // Nếu status là "creating", bắt đầu polling để check DB
      if (status === "creating") {
        this.startPollingForConsumer(consumerId);
      }
    },

    // ✅ Method để parent hoặc child component gọi khi bắt đầu stop consumer
    addStoppingConsumer(consumerId) {
      console.log(`🛑 Adding consumer ${consumerId} to stopping state`);
      this.addTemporaryConsumer(consumerId, "stopping");
    },

    // ✅ Poll database để check consumer đã được tạo chưa
    startPollingForConsumer(consumerId, maxAttempts = 60) {
      let attempts = 0;
      const pollInterval = setInterval(async () => {
        attempts++;
        console.log(
          `Polling for consumer ${consumerId}, attempt ${attempts}/${maxAttempts}`
        );

        try {
          const statsResponse = await getConsumerStats();
          if (statsResponse.success) {
            const foundConsumer = statsResponse.instances?.find(
              (instance) =>
                instance.id === consumerId && instance.status === "active"
            );

            if (foundConsumer) {
              console.log(`✅ Consumer ${consumerId} found in database!`);
              clearInterval(pollInterval);
              // Refresh để cập nhật từ DB
              this.refreshConsumerInstances();
              return;
            }
          }
        } catch (error) {
          console.error(`Error polling for consumer ${consumerId}:`, error);
        }

        // Nếu đã poll quá nhiều lần, dừng lại
        if (attempts >= maxAttempts) {
          console.warn(
            `❌ Polling timeout for consumer ${consumerId} after ${maxAttempts} attempts`
          );
          clearInterval(pollInterval);
          // Remove temporary consumer nếu không tìm thấy trong DB
          this.consumerInstances = this.consumerInstances.filter(
            (c) => c.consumerId !== consumerId || c.status !== "creating"
          );
        }
      }, 1000); // Poll mỗi 1 giây
    },

    // ✅ Clear polling interval cho consumer
    clearPollingInterval(consumerId) {
      const intervalId = this.pollingIntervals.get(consumerId);
      if (intervalId) {
        console.log(`🛑 Clearing polling interval for ${consumerId}`);
        clearInterval(intervalId);
        this.pollingIntervals.delete(consumerId);
      }
    },

    // ✅ Poll database để check consumer đã được stopped (INACTIVE) chưa
    startPollingForStoppingConsumer(consumerId, maxAttempts = 20) {
      // ✅ Clear existing polling nếu có
      this.clearPollingInterval(consumerId);

      let attempts = 0;
      const pollInterval = setInterval(async () => {
        attempts++;
        console.log(
          `Polling for stopped consumer ${consumerId}, attempt ${attempts}/${maxAttempts}`
        );

        try {
          const statsResponse = await getConsumerStats();
          if (statsResponse.success) {
            const foundConsumer = statsResponse.instances?.find(
              (instance) => instance.id === consumerId
            );

            // Check nếu consumer đã thành INACTIVE hoặc không tồn tại (đã bị xóa)
            if (!foundConsumer || foundConsumer.status === "inactive") {
              console.log(
                `✅ Consumer ${consumerId} stopped successfully in database!`
              );
              this.clearPollingInterval(consumerId);

              // Clear stopping state trong ConsumerList nếu có
              if (
                this.$refs.consumerList &&
                this.$refs.consumerList.stoppingConsumers
              ) {
                this.$refs.consumerList.stoppingConsumers.delete(consumerId);
              }

              // Refresh để cập nhật từ DB
              this.refreshConsumerInstances();
              return;
            }
          }
        } catch (error) {
          console.error(
            `Error polling for stopped consumer ${consumerId}:`,
            error
          );
        }

        // Nếu đã poll quá nhiều lần, dừng lại
        if (attempts >= maxAttempts) {
          console.warn(
            `❌ Polling timeout for stopped consumer ${consumerId} after ${maxAttempts} attempts`
          );
          this.clearPollingInterval(consumerId);

          // Clear stopping state anyway khi timeout
          if (
            this.$refs.consumerList &&
            this.$refs.consumerList.stoppingConsumers
          ) {
            this.$refs.consumerList.stoppingConsumers.delete(consumerId);
          }

          // Refresh để hiện trạng thái thực tế
          this.refreshConsumerInstances();
        }
      }, 1000); // Poll mỗi 1 giây

      // ✅ Lưu interval ID để có thể clear sau
      this.pollingIntervals.set(consumerId, pollInterval);
    },



    // ✅ Fetch data từ API (chỉ dùng lần đầu hoặc khi cần refresh manual)
    async fetchConsumerData() {
      try {
        const statsResponse = await getConsumerStats();

        if (statsResponse.success) {
          this.statistics = {
            totalMessages: statsResponse.totalMessages || 0,
            processedMessages: statsResponse.processedMessages || 0,
            failedMessages: statsResponse.failedMessages || 0,
            activeConsumers: statsResponse.activeConsumers || 0,
          };

          // Cập nhật consumer instances và normalize status
          this.consumerInstances = (statsResponse.instances || []).map(
            (instance) => ({
              ...instance,
              consumerId: instance.id || instance.consumerId, // Map 'id' to 'consumerId'
              status: (instance.status || "").toLowerCase(), // Normalize to lowercase
            })
          );

          console.log("📊 Consumer Instances loaded:", this.consumerInstances);
        }
      } catch (error) {
        console.error("Error fetching consumer data:", error);
      } finally {
        this.loading = false;
      }
    },

    // ✅ Fetch all logs với pagination
    async fetchAllLogs() {
      this.loadingLogs = true;
      try {
        const params = {
          page: this.currentPage,
          limit: this.itemsPerPage,
        };
        if (this.filterStatus) {
          params.status = this.filterStatus;
        }

        const response = await getConsumerLogs(params);

        if (response.success) {
          this.allLogs = response.data || [];
          this.pagination = response.pagination;
        }
      } catch (error) {
        console.error("Error fetching logs:", error);
      } finally {
        this.loadingLogs = false;
      }
    },

    // ✅ Go to specific page
    goToPage(page) {
      if (page >= 1 && page <= this.pagination.totalPages) {
        this.currentPage = page;
        this.fetchAllLogs();
      }
    },

    // ✅ Search log by ID
    async searchLogById() {
      if (!this.searchId) return;

      this.searching = true;

      try {
        const response = await getConsumerLogById(this.searchId);

        if (response.success) {
          this.selectedLog = response.data;
        } else {
          alert('❌ ' + (response.message || 'Không tìm thấy log'));
        }
      } catch (error) {
        console.error("Error searching log:", error);
        alert('❌ Có lỗi xảy ra khi tìm kiếm');
      } finally {
        this.searching = false;
      }
    },

    // ✅ View log details
    viewLogDetails(logId) {
      this.searchId = logId;
      this.searchLogById();
    },

    // ✅ Close log detail modal
    closeLogDetail() {
      this.selectedLog = null;
      this.searchId = '';
    },

    // ✅ Get status class cho badge
    getStatusClass(status) {
      const classes = {
        RECEIVED: "bg-yellow-100 text-yellow-800",
        PROCESSING: "bg-blue-100 text-blue-800",
        PROCESSED: "bg-green-100 text-green-800",
        FAILED: "bg-red-100 text-red-800",
      };
      return classes[status] || "bg-gray-100 text-gray-800";
    },

    // ✅ Format log data
    formatLogData(data) {
      return JSON.stringify(data, null, 2);
    },

    // ✅ Copy to clipboard
    copyToClipboard(text) {
      navigator.clipboard.writeText(text).then(() => {
        alert('✅ Đã copy vào clipboard!');
      }).catch(err => {
        console.error('Failed to copy:', err);
        alert('❌ Không thể copy');
      });
    },
    getSuccessRateClass(rate) {
      if (rate >= 95) return "text-green-600 font-bold";
      if (rate >= 80) return "text-yellow-600 font-bold";
      return "text-red-600 font-bold";
    },
    formatNumber(num) {
      return num?.toLocaleString() || 0;
    },
    formatDate(date) {
      if (!date) return "N/A";
      const d = new Date(date);
      return d.toLocaleString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    },
    handleConsumerCreated(data) {
      // Hiển thị thông báo ngay lập tức
      console.log(`✅ Đang khởi tạo ${data.count || 1} consumers cho Group "${data.groupId || '...'}"`);

      // Đóng modal
      this.showAddModal = false;

      // --- CƠ CHẾ POLLING (TỰ ĐỘNG REFRESH) ---
      // Docker mất khoảng 5-10s để container start và ghi vào DB
      // Chúng ta sẽ fetch lại dữ liệu 5 lần, mỗi lần cách nhau 2 giây
      let attempts = 0;
      const maxAttempts = 6;

      // Fetch ngay lập tức lần 1
      this.fetchConsumerData();

      const intervalId = setInterval(() => {
        attempts++;
        console.log(`Auto-refreshing consumers list (Attempt ${attempts}/${maxAttempts})...`);
        this.fetchConsumerData();

        if (attempts >= maxAttempts) {
          clearInterval(intervalId);
          console.log("✅ Hoàn tất quá trình khởi tạo. Kiểm tra danh sách.");
        }
      }, 2500); // 2.5 giây refresh 1 lần
    },

    handleStartStopPolling(consumerId) {
      console.log("🛑 Starting stop polling for consumer:", consumerId);
      // Ngay lập tức thêm consumer vào local state với trạng thái stopping - GIỐNG HỆT CREATING
      this.addTemporaryConsumer(consumerId, "stopping");

      // Bắt đầu polling để check khi nào consumer thành INACTIVE trong DB
      this.startPollingForStoppingConsumer(consumerId);
    },

    handleConsumerStopped(consumerId) {
      console.log("Consumer stopped:", consumerId);

      // ✅ QUAN TRỌNG: Clear polling interval ngay khi nhận WebSocket event
      this.clearPollingInterval(consumerId);

      // Clear stopping state trong ConsumerList
      if (this.$refs.consumerList && this.$refs.consumerList.stoppingConsumers) {
        this.$refs.consumerList.stoppingConsumers.delete(consumerId);
      }

      // Update local state ngay lập tức - Dùng splice để trigger Vue reactivity
      const consumerIndex = this.consumerInstances.findIndex(
        (c) => c.consumerId === consumerId
      );
      if (consumerIndex >= 0) {
        const updatedConsumer = {
          ...this.consumerInstances[consumerIndex],
          status: "inactive",
        };
        this.consumerInstances.splice(consumerIndex, 1, updatedConsumer);
      }

      // Update statistics ngay lập tức
      this.statistics.activeConsumers = this.consumerInstances.filter(
        (c) => c.status === "active"
      ).length;
    },
    handleConsumerResumed(consumerId) {
      console.log("Consumer resumed:", consumerId);
      // Update local state ngay lập tức
      const consumer = this.consumerInstances.find(
        (c) => c.consumerId === consumerId
      );
      if (consumer) {
        consumer.status = "active";
      }
      // Refresh lại stats
      setTimeout(() => {
        this.refreshConsumerInstances();
      }, 1000);
    },
    handleConsumerDeleted(consumerId) {
      console.log("Consumer deleted:", consumerId);
      // Remove khỏi local state ngay lập tức
      this.consumerInstances = this.consumerInstances.filter(
        (c) => c.consumerId !== consumerId
      );
      // Chỉ update statistics, KHÔNG refresh lại consumer instances để tránh restore
      this.statistics.activeConsumers = this.consumerInstances.filter(
        (c) => c.status === "active"
      ).length;
    },
  },
};
</script>
