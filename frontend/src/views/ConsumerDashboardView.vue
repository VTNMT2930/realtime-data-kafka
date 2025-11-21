<template>
  <div class="p-6">
    <div class="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
      <div>
        <h1 class="text-3xl font-bold text-gray-800">📥 Quản lý Consumers</h1>
        <p class="text-gray-500 text-sm mt-1">Giám sát và điều khiển các instance Kafka Consumers</p>
      </div>
      
      <div class="flex gap-3">
        <button
          @click="fetchConsumerData"
          class="bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 transition flex items-center gap-2"
        >
          <span>🔄</span> Refresh
        </button>
        <button
          @click="showAddModal = true"
          class="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition flex items-center gap-2 shadow-sm"
        >
          <span>➕</span> Scale Up Consumer
        </button>
      </div>
    </div>

    <SystemStatus :stats="statistics" class="mb-6" />

    <div class="mb-6 relative">
      <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <svg class="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clip-rule="evenodd" />
        </svg>
      </div>
      <input
        v-model="searchQuery"
        type="text"
        placeholder="🔍 Tìm kiếm theo Instance ID, Group ID, hoặc Topic..."
        class="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm shadow-sm"
      />
    </div>

    <div v-if="loading" class="flex justify-center py-10">
      <div class="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
    </div>

    <ConsumerList 
      v-else 
      :consumers="filteredConsumers" 
      @stop="handleStopConsumer"
      @resume="handleResumeConsumer"
      @delete="handleDeleteConsumer"
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
      consumerInstances: [], // Dữ liệu gốc từ API
      statistics: {
        activeConsumers: 0,
        totalTopics: 0,
        messagesPerSecond: 0,
      },
      loading: false,
      showAddModal: false,
      searchQuery: "", // Biến lưu từ khóa tìm kiếm
    };
  },
  computed: {
    // LOGIC TÌM KIẾM: Lọc theo nhiều trường
    filteredConsumers() {
      if (!this.searchQuery) {
        return this.consumerInstances;
      }
      
      const lowerQuery = this.searchQuery.toLowerCase().trim();
      
      return this.consumerInstances.filter((consumer) => {
        // 1. Tìm theo Instance ID (VD: test1-inst-0)
        const matchId = consumer.id && consumer.id.toLowerCase().includes(lowerQuery);
        
        // 2. Tìm theo Group ID (VD: test1)
        const matchGroup = consumer.groupId && consumer.groupId.toLowerCase().includes(lowerQuery);
        
        // 3. Tìm theo Topic (Kiểm tra cả mảng topics hoặc topicName đơn lẻ)
        const topicsStr = consumer.topics || consumer.topicName || "";
        const matchTopic = topicsStr.toLowerCase().includes(lowerQuery);

        return matchId || matchGroup || matchTopic;
      });
    },
  },
  methods: {
    async fetchConsumerData() {
      this.loading = true;
      try {
        // Gọi API lấy danh sách
        const data = await getConsumerInstances();
        // Sắp xếp: Active lên đầu, sau đó theo ID
        this.consumerInstances = (data || []).sort((a, b) => {
           if (a.status === b.status) return a.id.localeCompare(b.id);
           return a.status === 'active' ? -1 : 1;
        });
        
        // Cập nhật thống kê cơ bản
        this.updateStatistics();
      } catch (error) {
        console.error("Lỗi tải data:", error);
        this.showToast("error", "Không thể tải danh sách consumer.");
      } finally {
        this.loading = false;
      }
    },
    
    updateStatistics() {
       this.statistics.activeConsumers = this.consumerInstances.filter(c => c.status === 'active' || c.status === 'ACTIVE').length;
       // Các chỉ số khác có thể lấy từ API stats riêng nếu cần
    },

    // Xử lý sự kiện từ Modal
    handleConsumerCreated(data) {
        this.showToast("success", `Đang khởi tạo ${data.count} instances...`);
        this.showAddModal = false;
        
        // Auto Refresh thông minh (Polling)
        let attempts = 0;
        const interval = setInterval(() => {
            attempts++;
            this.fetchConsumerData(); // Reload ngầm (không hiện loading spinner toàn trang nếu muốn)
            if (attempts >= 5) clearInterval(interval);
        }, 2000);
    },

    // Các hàm Action (Stop, Resume, Delete) giữ nguyên logic gọi API
    async handleStopConsumer(id) {
        if(!confirm(`Bạn chắc chắn muốn dừng instance ${id}?`)) return;
        try {
            await stopConsumer(id);
            this.showToast("success", "Đã gửi lệnh dừng instance.");
            this.fetchConsumerData();
        } catch(e) {
            this.showToast("error", e.message);
        }
    },
    
    async handleResumeConsumer(id) {
        try {
            await resumeConsumer(id);
            this.showToast("success", "Đã gửi lệnh khởi động lại.");
            this.fetchConsumerData();
        } catch(e) {
            this.showToast("error", e.message);
        }
    },

    async handleDeleteConsumer(id) {
        if(!confirm(`CẢNH BÁO: Bạn có chắc chắn muốn xóa vĩnh viễn ${id}?`)) return;
        try {
            await deleteConsumerInstance(id);
            this.showToast("success", "Đã xóa instance khỏi hệ thống.");
            this.fetchConsumerData();
        } catch(e) {
            this.showToast("error", e.message);
        }
    }
  },
  mounted() {
    this.fetchConsumerData();
    // Auto refresh mỗi 30s
    this.pollingInterval = setInterval(this.fetchConsumerData, 30000);
  },
  beforeUnmount() {
    if (this.pollingInterval) clearInterval(this.pollingInterval);
  }
};
</script>