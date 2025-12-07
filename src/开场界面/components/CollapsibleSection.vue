<template>
  <div class="collapsible-section">
    <button class="collapsible-header" :class="{ expanded: isExpanded }" @click="toggle">
      <span class="header-title">
        <component :is="icon" v-if="icon" class="icon-sm" />
        {{ title }}
        <span v-if="badge" class="badge">{{ badge }}</span>
      </span>
      <svg class="chevron-icon" :class="{ rotated: isExpanded }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>
    <Transition name="slide">
      <div v-show="isExpanded" class="collapsible-content">
        <slot />
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

interface Props {
  title: string;
  icon?: any;
  badge?: string | number;
  defaultExpanded?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  defaultExpanded: false,
});

const isExpanded = ref(props.defaultExpanded);

function toggle() {
  isExpanded.value = !isExpanded.value;
}

defineExpose({
  toggle,
  isExpanded: () => isExpanded.value,
});
</script>

<style lang="scss" scoped>
.collapsible-section {
  background: rgba(255, 255, 255, 0.6);
  border-radius: 12px;
  overflow: hidden;
  backdrop-filter: blur(10px);
}

.collapsible-header {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all 0.3s;
  text-align: left;

  &:hover {
    background: rgba(0, 0, 0, 0.05);
  }

  &.expanded {
    border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  }
}

.header-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: var(--foreground);
}

.badge {
  padding: 2px 8px;
  background: rgba(236, 72, 153, 0.2);
  color: var(--primary-color, #ec4899);
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.chevron-icon {
  width: 20px;
  height: 20px;
  transition: transform 0.3s;
  color: var(--muted-foreground);

  &.rotated {
    transform: rotate(180deg);
  }
}

.collapsible-content {
  padding: 16px;
  animation: slideDown 0.3s ease-out;
  // 允许内容自然展开，由父容器控制滚动
  overflow: visible;
  max-height: none;
}

@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease;
  overflow: hidden;
}

.slide-enter-from,
.slide-leave-to {
  max-height: 0;
  opacity: 0;
  padding-top: 0;
  padding-bottom: 0;
}

.slide-enter-to,
.slide-leave-from {
  max-height: 2000px;
  opacity: 1;
}
</style>
