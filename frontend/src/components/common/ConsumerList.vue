<template>
  <div class="bg-white rounded-lg shadow overflow-hidden">
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th
              scope="col"
              class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              Status
            </th>
            
            <th
              scope="col"
              class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              Instance ID
            </th>

            <th
              scope="col"
              class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              Group ID
            </th>

            <th
              scope="col"
              class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              Topics
            </th>
            
            <th scope="col" class="relative px-6 py-3">
              <span class="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          <tr v-for="consumer in consumers" :key="consumer.id" class="hover:bg-gray-50 transition">
            
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

            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
              <span class="px-2 py-1 bg-blue-50 text-blue-700 rounded border border-blue-100 font-mono text-xs">
                 {{ consumer.groupId || 'N/A' }}
              </span>
            </td>

            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
              <div class="flex flex-wrap gap-1 max-w-xs">
                <span 
                  v-for="topic in (consumer.topics ? consumer.topics.split(',') : [consumer.topicName])" 
                  :key="topic"
                  class="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs"
                >
                  {{ topic || 'All Topics' }}
                </span>
              </div>
            </td>

            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
               <button 
                  v-if="consumer.status === 'active' || consumer.status === 'ACTIVE'"
                  @click="$emit('stop', consumer.id)" 
                  class="text-orange-600 hover:text-orange-900 mr-3"
                  title="Stop Instance"
               >
                 Stop
               </button>
               <button 
                  v-else
                  @click="$emit('resume', consumer.id)" 
                  class="text-green-600 hover:text-green-900 mr-3"
                  title="Resume Instance"
               >
                 Resume
               </button>

               <button 
                  @click="$emit('delete', consumer.id)" 
                  class="text-red-600 hover:text-red-900"
                  title="Delete Instance"
               >
                 Delete
               </button>
            </td>
          </tr>
          
          <tr v-if="consumers.length === 0">
            <td colspan="5" class="px-6 py-10 text-center text-gray-500">
              Không có consumer nào đang chạy.
            </td>
          </tr>
        </tbody>
      </table>
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
  emits: ['stop', 'resume', 'delete']
};
</script>