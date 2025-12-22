<template>
  <div v-if="content" class="note-card">
    <div class="note-content">{{ content }}</div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  content?: string;
}

defineProps<Props>();
</script>

<style scoped>
.note-card {
  background: rgba(255, 255, 255, 0.9);
  border-left: 4px solid #fbbf24;
  padding: 12px 16px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  margin-bottom: 12px;
}

.note-content {
  color: #78350f;
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-wrap;
}
</style>
