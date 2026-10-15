<script lang="ts">
  import { Icon } from '@immich/ui';
  import { mdiLockOutline } from '@mdi/js';
  import { t } from 'svelte-i18n';

  interface Props {
    class?: string;
  }

  let { class: className }: Props = $props();
</script>

<div
  class="flex aspect-square w-full items-center justify-center rounded-xl bg-linear-to-br from-gray-300 to-gray-500 blur-[1px] dark:from-gray-700 dark:to-gray-900 {className}"
  role="img"
  aria-label={$t('locked_album')}
>
  <Icon icon={mdiLockOutline} size="48" class="text-white/80" />
</div>
