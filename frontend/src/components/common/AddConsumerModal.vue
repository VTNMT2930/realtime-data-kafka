<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
  >
    <div
      class="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 transform transition-all"
    >
      <div class="flex items-center justify-between p-6 border-b bg-gray-50 rounded-t-lg">
        <h3 class="text-xl font-bold text-gray-800 flex items-center gap-2">
          <span class="text-2xl">⚡</span> Setup Consumer Group
        </h3>
        <button
          @click="closeModal"
          class="text-gray-400 hover:text-gray-600 transition focus:outline-none"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div class="p-6 space-y-5">
        
        <div>
          <label class="block text-sm font-semibold text-gray-700 mb-1">
            Consumer Group ID <span class="text-red-500">*</span>
          </label>
          <input
            v-model="formData.groupId"
            type="text"
            placeholder="Ví dụ: order-processing-group"
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition"
          />
          <p class="text-xs text-gray-500 mt-1">Các instance cùng Group sẽ chia sẻ tải với nhau.</p>
        </div>

        <div>
          <label class="block text-sm font-semibold text-gray-700 mb-1">
            Số lượng Instance (Scale) <span class="text-red-500">*</span>
          </label>
          <div class="flex items-center gap-3">
            <input
              v-model.number="formData.count"
              type="range"
              min="1"
              max="5"
              class="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <span class="px-3 py-1 bg-blue-100 text-blue-800 font-bold rounded-lg min-w-[3rem] text-center">
              {{ formData.count }}
            </span>
          </div>
          <p class="text-xs text-gray-500 mt-1">Số lượng Docker Container chạy song song.</p>
        </div>

        <div>
          <label class="block text-sm font-semibold text-gray-700 mb-1">
            Topics (Subscribe) <span class="text-red-500">*</span>
          </label>
          <input
            v-model="formData.topicsInput"
            type="text"
            placeholder="Nhập tên topic (phân cách bằng dấu phẩy)"
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition"
          />
          
          <div v-if="parsedTopics.length > 0" class="flex flex-wrap gap-2 mt-3">
            <span v-for="topic in parsedTopics" :key="topic" class="px-2 py-1 bg-purple-100 text-purple-700 text-xs font-medium rounded-full flex items-center gap-1">
              #{{ topic }}
            </span>
          </div>
        </div>

        <div v-if="error" class="p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-200 flex items-start gap-2">
          <span>⚠️</span> <span>{{ error }}</span>
        </div>

        <div v-if="success" class="p-3 bg-green-50 text-green-700 rounded-lg text-sm border border-green-200 flex items-start gap-2">
          <span>✅</span> <span>{{ success }}</span>
        </div>
      </div>

      <div class="flex justify-end gap-3 p-6 border-t bg-gray-50 rounded-b-lg">
        <button
          @click="closeModal"
          class="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition font-medium"
          :disabled="loading"
        >
          Hủy bỏ
        </button>
        <button
          @click="handleCreate"
          class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2 font-medium shadow-sm"
          :disabled="loading"
        >
          <svg v-if="loading" class="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          {{ loading ? "Đang khởi tạo..." : "Deploy Consumers" }}
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { createAdvancedConsumer } from "@/services/apiService"; // Import hàm mới

export default {
  name: "AddConsumerModal",
  props: {
    isOpen: Boolean,
  },
  data() {
    return {
      loading: false,
      error: null,
      success: null,
      formData: {
        groupId: "",
        count: 1,
        topicsInput: "",
      },
    };
  },
  computed: {
    parsedTopics() {
      if (!this.formData.topicsInput) return [];
      return this.formData.topicsInput
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
    },
  },
  watch: {
    isOpen(newVal) {
      if (newVal) {
        // Reset form khi mở modal
        this.error = null;
        this.success = null;
        this.formData = { groupId: "", count: 1, topicsInput: "" };
      }
    },
  },
  methods: {
    closeModal() {
      if (!this.loading) this.$emit("close");
    },
    async handleCreate() {
      // Validate
      if (!this.formData.groupId || this.parsedTopics.length === 0) {
        this.error = "Vui lòng nhập Group ID và ít nhất 1 Topic.";
        return;
      }

      this.loading = true;
      this.error = null;
      this.success = null;

      try {
        // Gọi API Advanced
        const response = await createAdvancedConsumer(
          this.formData.groupId,
          this.parsedTopics,
          this.formData.count
        );

        this.success = `Đã gửi lệnh tạo ${this.formData.count} instances. Hệ thống đang khởi động...`;
        
        // Emit event để Dashboard biết
        this.$emit("consumer-created", { 
            groupId: this.formData.groupId,
            count: this.formData.count 
        });

        setTimeout(() => {
          this.closeModal();
        }, 2000);

      } catch (err) {
        console.error(err);
        this.error = err.message || "Lỗi kết nối Server.";
      } finally {
        this.loading = false;
      }
    },
  },
};
</script>