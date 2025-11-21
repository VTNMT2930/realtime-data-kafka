<template>
  <div class="p-6">
    <div class="flex items-center justify-between mb-6">
      <div class="flex items-center space-x-3">
        <button
          @click="$router.push('/')"
          class="text-green-600 hover:text-green-800 transition"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>
        <h1 class="text-3xl font-bold">📥 Quản lý consumer</h1>
      </div>
      <button
        @click="fetchConsumerData"
        class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition flex items-center space-x-2"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        <span>Refresh Data</span>
      </button>
    </div>

    <SystemStatus :stats="statistics" class="mb-6" />

    <div class="mb-6">
      <div class="relative">
        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <svg class="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd" />
          </svg>
        </div>
        <input
          v-model="searchQuery"
          type="text"
          placeholder="🔍 Search by Instance ID, Group ID, or Topic..."
          class="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 sm:text-sm shadow-sm"
        />
      </div>
    </div>

    <div v-if="loading" class="flex justify-center py-12">
      <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
    </div>

    <ConsumerList
      v-else
      ref="consumerList"
      :consumers="filteredConsumers"
      @stop="handleStopConsumer"
      @resume="handleResumeConsumer"
      @delete="handleDeleteConsumer"
      @open-add-modal="showAddModal = true"
    />

    <AddConsumerModal
      :isOpen="showAddModal"
      @close="showAddModal = false"
      @consumer-created="handleConsumerCreated"
    />

    <ToastContainer />
  </div>
</template>

<script>
import ConsumerList from "@/components/common/ConsumerList.vue";
import SystemStatus from "@/components/common/SystemStatus.vue";
import AddConsumerModal from "@/components/common/AddConsumerModal.vue";
import ToastContainer from "@/components/common/ToastContainer.vue";
import { useToast } from "@/composables/useToast";
import { getConsumerInstances, stopConsumer, resumeConsumer, deleteConsumerInstance } from "@/services/apiService";

export default {
  name: "ConsumerDashboardView",
  components: {
    ConsumerList,
    SystemStatus,
    AddConsumerModal,
    ToastContainer,
  },
  setup() {
    const { showToast } = useToast();
    return { showToast };
  },
  data() {
    return {
      consumerInstances: [],
      statistics: {
        activeConsumers: 0,
        totalTopics: 0,
        messagesPerSecond: 0,
      },
      loading: false,
      showAddModal: false,
      searchQuery: "", // Biến cho ô tìm kiếm
    };
  },
  computed: {
    // --- LOGIC TÌM KIẾM MỚI ---
    filteredConsumers() {
      if (!this.searchQuery) return this.consumerInstances;
      
      const query = this.searchQuery.toLowerCase().trim();
      return this.consumerInstances.filter(c => {
        const idMatch = c.id && c.id.toLowerCase().includes(query);
        const groupMatch = c.groupId && c.groupId.toLowerCase().includes(query);
        // Topic có thể là chuỗi "topic1,topic2" hoặc trường topicName cũ
        const topicMatch = (c.topics || c.topicName || '').toLowerCase().includes(query);
        
        return idMatch || groupMatch || topicMatch;
      });
    }
  },
  methods: {
    async fetchConsumerData() {
      this.loading = true;
      try {
        const data = await getConsumerInstances();
        // Sort: Active lên đầu
        this.consumerInstances = (data || []).sort((a, b) => {
            if (a.status === 'active' || a.status === 'ACTIVE') return -1;
            if (b.status === 'active' || b.status === 'ACTIVE') return 1;
            return 0;
        });
        this.updateStatistics();
      } catch (error) {
        console.error("Error fetching data:", error);
        this.showToast("error", "Failed to load consumers.");
      } finally {
        this.loading = false;
      }
    },

    updateStatistics() {
      this.statistics.activeConsumers = this.consumerInstances.filter(
        (c) => c.status === "active" || c.status === "ACTIVE"
      ).length;
      // Các stats khác có thể update từ API khác
    },

    // --- CÁC HÀM XỬ LÝ SỰ KIỆN (Giữ nguyên logic cũ) ---
    handleConsumerCreated(data) {
        this.showToast("success", `Deploying ${data.count || 1} instances...`);
        this.showAddModal = false;
        
        // Auto refresh
        let attempts = 0;
        const interval = setInterval(() => {
            attempts++;
            this.fetchConsumerData(); // Gọi lại API để cập nhật list
            if (attempts >= 5) clearInterval(interval);
        }, 2000);
    },

    async handleStopConsumer(id) {
        if (!confirm(`Are you sure you want to stop consumer ${id}?`)) return;
        try {
            // Thêm vào Set stopping ở component con
            if (this.$refs.consumerList) {
                this.$refs.consumerList.stoppingConsumers.add(id);
            }
            await stopConsumer(id);
            this.showToast("info", "Stop signal sent.");
            // Logic WebSocket sẽ confirm sau, hoặc refresh tay
            setTimeout(() => this.fetchConsumerData(), 1000);
        } catch(e) {
            this.showToast("error", e.message);
            if (this.$refs.consumerList) {
                this.$refs.consumerList.stoppingConsumers.delete(id);
            }
        }
    },

    async handleResumeConsumer(id) {
        try {
            await resumeConsumer(id);
            this.showToast("success", "Resume signal sent.");
            setTimeout(() => this.fetchConsumerData(), 1000);
        } catch(e) {
            this.showToast("error", e.message);
        }
    },

    async handleDeleteConsumer(id) {
        if (!confirm(`Delete consumer ${id}? This cannot be undone.`)) return;
        try {
            if (this.$refs.consumerList) {
                this.$refs.consumerList.deletingConsumers.add(id);
            }
            await deleteConsumerInstance(id);
            this.showToast("success", "Consumer deleted.");
            this.fetchConsumerData();
        } catch(e) {
             this.showToast("error", e.message);
             if (this.$refs.consumerList) {
                this.$refs.consumerList.deletingConsumers.delete(id);
            }
        }
    },
    
    // Các hàm handle WebSocket event (nếu có trong file cũ) thì bạn giữ nguyên nhé
    // handleConsumerStopped(id) { ... }
    // handleConsumerResumed(id) { ... }
    // handleConsumerDeleted(id) { ... }
  },
  mounted() {
    this.fetchConsumerData();
  }
};
</script>