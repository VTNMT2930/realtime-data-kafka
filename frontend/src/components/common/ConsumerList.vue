<template>
  <div class="bg-white rounded-lg shadow-md p-6">
    <div class="flex items-center justify-between mb-6">
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
          <svg class="w-6 h-6 text-green-600" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
          </svg>
        </div>
        <div>
          <h2 class="text-xl font-bold text-gray-800">👥 Consumer Management</h2>
          <p class="text-sm text-gray-500">Manage and monitor your consumer instances</p>
        </div>
      </div>
      
      <button
        @click="$emit('open-add-modal')"
        class="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg shadow-sm transition flex items-center gap-2"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
        <span>Add Consumer</span>
      </button>
    </div>

    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Instance ID
            </th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Group ID
            </th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Topics
            </th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Last Heartbeat
            </th>
            <th scope="col" class="relative px-6 py-3">
              <span class="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          <tr v-for="consumer in paginatedConsumers" :key="consumer.id" class="hover:bg-gray-50 transition">
            <td class="px-6 py-4 whitespace-nowrap">
              <span
                class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full"
                :class="{
                  'bg-green-100 text-green-800': consumer.status === 'ACTIVE' || consumer.status === 'active',
                  'bg-red-100 text-red-800': consumer.status !== 'ACTIVE' && consumer.status !== 'active',
                }"
              >
                {{ consumer.status }}
              </span>
            </td>

            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
              {{ consumer.id }}
            </td>

            <td class="px-6 py-4 whitespace-nowrap text-sm text-blue-600 font-medium">
              {{ consumer.groupId || 'N/A' }}
            </td>

            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
              <div class="flex flex-wrap gap-1 max-w-xs">
                <span 
                  v-for="topic in (consumer.topics ? consumer.topics.split(',') : [consumer.topicName])" 
                  :key="topic"
                  class="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs border border-gray-200"
                >
                  {{ topic || 'All' }}
                </span>
              </div>
            </td>

            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
              {{ formatTimeAgo(consumer.lastHeartbeat) }}
            </td>

            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
               <button 
                  v-if="consumer.status === 'ACTIVE' || consumer.status === 'active'"
                  @click="$emit('stop', consumer.id)" 
                  class="text-orange-600 hover:text-orange-900 mr-3 disabled:opacity-50"
                  :disabled="stoppingConsumers.has(consumer.id)"
               >
                 {{ stoppingConsumers.has(consumer.id) ? 'Stopping...' : 'Stop' }}
               </button>
               <button 
                  v-else
                  @click="$emit('resume', consumer.id)" 
                  class="text-green-600 hover:text-green-900 mr-3 disabled:opacity-50"
               >
                 Resume
               </button>

               <button 
                  @click="$emit('delete', consumer.id)" 
                  class="text-red-600 hover:text-red-900 disabled:opacity-50"
                  :disabled="deletingConsumers.has(consumer.id)"
               >
                 {{ deletingConsumers.has(consumer.id) ? 'Deleting...' : 'Delete' }}
               </button>
            </td>
          </tr>
          
          <tr v-if="consumers.length === 0">
            <td colspan="6" class="px-6 py-10 text-center text-gray-500">
              No consumers found.
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6 mt-4">
       <div class="flex flex-1 justify-between sm:hidden">
        <button @click="goToPage(currentPage - 1)" :disabled="currentPage === 1" class="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Previous</button>
        <button @click="goToPage(currentPage + 1)" :disabled="currentPage === totalPages" class="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Next</button>
      </div>
      <div class="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
        <div>
          <p class="text-sm text-gray-700">
            Showing <span class="font-medium">{{ startIndex + 1 }}</span> to <span class="font-medium">{{ Math.min(endIndex, consumers.length) }}</span> of <span class="font-medium">{{ consumers.length }}</span> results
          </p>
        </div>
        <div>
          <nav class="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
             <button @click="goToFirstPage" :disabled="currentPage === 1" class="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0">First</button>
             <button @click="goToPage(currentPage - 1)" :disabled="currentPage === 1" class="relative inline-flex items-center px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0">Prev</button>
             <span class="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-900 ring-1 ring-inset ring-gray-300 focus:outline-offset-0">{{ currentPage }} / {{ totalPages }}</span>
             <button @click="goToPage(currentPage + 1)" :disabled="currentPage === totalPages" class="relative inline-flex items-center px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0">Next</button>
             <button @click="goToLastPage" :disabled="currentPage === totalPages" class="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0">Last</button>
          </nav>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: "ConsumerList",
  props: {
    consumers: {
      type: Array,
      default: () => [],
    },
  },
  data() {
    return {
      currentPage: 1,
      itemsPerPage: 10,
      stoppingConsumers: new Set(),
      deletingConsumers: new Set(),
      // statusFilter: 'all' // Nếu bạn có filter ở đây thì giữ nguyên
    };
  },
  computed: {
    // Logic Pagination (Giữ nguyên)
    totalPages() {
      return Math.ceil(this.consumers.length / this.itemsPerPage) || 1;
    },
    startIndex() {
      return (this.currentPage - 1) * this.itemsPerPage;
    },
    endIndex() {
      return this.startIndex + this.itemsPerPage;
    },
    paginatedConsumers() {
      return this.consumers.slice(this.startIndex, this.endIndex);
    }
  },
  watch: {
    consumers() {
        // Reset về trang 1 nếu data thay đổi (vd: search)
        // this.currentPage = 1; 
    }
  },
  methods: {
    formatTimeAgo(dateStr) {
        if (!dateStr) return 'N/A';
        const date = new Date(dateStr);
        const now = new Date();
        const diff = (now - date) / 1000;
        if (diff < 60) return `${Math.floor(diff)}s ago`;
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return date.toLocaleString();
    },
    goToPage(page) {
      if (page >= 1 && page <= this.totalPages) {
        this.currentPage = page;
      }
    },
    goToFirstPage() { this.currentPage = 1; },
    goToLastPage() { this.currentPage = this.totalPages; },
    
    // Các method confirm giữ nguyên cho logic WebSocket
    handleConsumerStoppedConfirmation(id) { this.stoppingConsumers.delete(id); },
    handleConsumerDeletedConfirmation(id) { this.deletingConsumers.delete(id); }
  },
  emits: ['stop', 'resume', 'delete', 'open-add-modal']
};
</script>