<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
    <div class="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 p-6">
      
      <h3 class="text-xl font-bold mb-4 flex items-center gap-2">
        <span>⚡</span> Tạo Advanced Consumer
      </h3>

      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700">Consumer Group ID</label>
          <input 
            v-model="formData.groupId" 
            type="text" 
            placeholder="Ví dụ: order-processing-group"
            class="w-full mt-1 p-2 border rounded focus:ring-blue-500 focus:border-blue-500 outline-none"
          />
          <p class="text-xs text-gray-500 mt-1">Các instance cùng Group sẽ chia nhau xử lý message.</p>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700">Số lượng Instance (Concurrency)</label>
          <input 
            v-model.number="formData.count" 
            type="number" 
            min="1" 
            max="10"
            class="w-full mt-1 p-2 border rounded focus:ring-blue-500 outline-none"
          />
          <p class="text-xs text-gray-500 mt-1">Số luồng xử lý song song (Nên <= số partition của topic).</p>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700">Subscribe Topics</label>
          <input 
            v-model="formData.topicsInput" 
            type="text" 
            placeholder="topic-a, topic-b, topic-c"
            class="w-full mt-1 p-2 border rounded focus:ring-blue-500 outline-none"
          />
          <p class="text-xs text-gray-500 mt-1">Nhập tên các topic, phân cách bằng dấu phẩy.</p>
        </div>

        <div v-if="parsedTopics.length > 0" class="flex flex-wrap gap-2 mt-2">
           <span v-for="t in parsedTopics" :key="t" class="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
             #{{ t }}
           </span>
        </div>
      </div>

      <div class="flex justify-end gap-3 mt-6 pt-4 border-t">
        <button @click="$emit('close')" class="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">Hủy</button>
        <button 
          @click="handleCreate" 
          class="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 flex items-center gap-2"
          :disabled="loading"
        >
          <span v-if="loading" class="animate-spin">⏳</span>
          {{ loading ? 'Đang tạo...' : 'Create Consumers' }}
        </button>
      </div>

    </div>
  </div>
</template>

<script>
import axios from 'axios';
// URL API Backend của bạn
const API_URL = process.env.PRODUCER_SERVICE_URL || "http://3.107.102.127:3000/api"; 

export default {
  props: ['isOpen'],
  data() {
    return {
      loading: false,
      formData: {
        groupId: '',
        count: 1,
        topicsInput: '' // Chuỗi nhập vào
      }
    };
  },
  computed: {
    // Tự động tách chuỗi thành mảng khi người dùng nhập
    parsedTopics() {
      if (!this.formData.topicsInput) return [];
      return this.formData.topicsInput
        .split(',')
        .map(t => t.trim())
        .filter(t => t.length > 0);
    }
  },
  methods: {
    async handleCreate() {
      if (!this.formData.groupId || this.parsedTopics.length === 0) {
        alert("Vui lòng nhập Group ID và ít nhất 1 Topic!");
        return;
      }

      this.loading = true;
      try {
        // Gọi API Advanced mới
        await axios.post(`${API_URL}/admin/consumers/advanced`, {
          groupId: this.formData.groupId,
          count: this.formData.count,
          topics: this.parsedTopics // Gửi mảng topic lên server
        });

        alert("✅ Đã tạo Consumer thành công!");
        this.$emit('consumer-created'); // Báo cho cha refresh
        this.$emit('close');
        
      } catch (e) {
        console.error(e);
        alert("Lỗi: " + (e.response?.data?.message || e.message));
      } finally {
        this.loading = false;
      }
    }
  }
}
</script>