<script lang="ts">
  import Qrcode from '$lib/components/shared-components/Qrcode.svelte';
  import { copyToClipboard } from '$lib/utils';
  import { handleError } from '$lib/utils/handle-error';
  import { disableMfa, enableMfa, getAuthStatus, setupMfa, type MfaSetupResponseDto } from '@immich/sdk';
  import { Button, Field, HStack, IconButton, Input, PasswordInput, PinInput, Text, toastManager } from '@immich/ui';
  import { mdiContentCopy } from '@mdi/js';
  import { onMount } from 'svelte';
  import { t } from 'svelte-i18n';
  import { fade } from 'svelte/transition';

  let isEnabled = $state(false);
  let isLoaded = $state(false);
  let setup = $state<MfaSetupResponseDto>();
  let code = $state('');
  let password = $state('');
  let usePassword = $state(false);
  let isLoading = $state(false);

  onMount(async () => {
    const { mfa } = await getAuthStatus();
    isEnabled = mfa;
    isLoaded = true;
  });

  const handleSetup = async () => {
    isLoading = true;
    try {
      setup = await setupMfa();
      code = '';
    } catch (error) {
      handleError(error, $t('unable_to_set_up_mfa'));
    } finally {
      isLoading = false;
    }
  };

  const handleEnable = async (event: Event) => {
    event.preventDefault();
    isLoading = true;
    try {
      await enableMfa({ mfaEnableDto: { code } });
      isEnabled = true;
      setup = undefined;
      code = '';
      toastManager.primary($t('mfa_enabled'));
    } catch (error) {
      code = '';
      handleError(error, $t('unable_to_enable_mfa'));
    } finally {
      isLoading = false;
    }
  };

  const handleDisable = async (event: Event) => {
    event.preventDefault();
    isLoading = true;
    try {
      await disableMfa({ mfaDisableDto: usePassword ? { password } : { code } });
      isEnabled = false;
      code = '';
      password = '';
      toastManager.primary($t('mfa_disabled'));
    } catch (error) {
      code = '';
      handleError(error, $t('unable_to_disable_mfa'));
    } finally {
      isLoading = false;
    }
  };

  const canDisable = $derived(usePassword ? password.length > 0 : code.length === 6);
</script>

<section class="my-4 sm:ms-8">
  {#if isLoaded && isEnabled}
    <form autocomplete="off" onsubmit={handleDisable} in:fade={{ duration: 200 }}>
      <div class="flex flex-col place-content-center place-items-center gap-6">
        <Text>{$t('mfa_is_enabled')}</Text>
        {#if usePassword}
          <Field label={$t('password')}>
            <PasswordInput bind:value={password} autocomplete="current-password" />
          </Field>
        {:else}
          <Field label={$t('mfa_code')}>
            <PinInput bind:value={code} />
          </Field>
        {/if}
        <button type="button" onclick={() => (usePassword = !usePassword)}>
          <Text color="muted" class="underline" size="small">
            {usePassword ? $t('mfa_use_code') : $t('mfa_use_password')}
          </Text>
        </button>
      </div>
      <div class="mt-4 flex justify-end">
        <Button shape="round" type="submit" size="small" color="danger" loading={isLoading} disabled={!canDisable}>
          {$t('disable')}
        </Button>
      </div>
    </form>
  {:else if isLoaded && setup}
    <form autocomplete="off" onsubmit={handleEnable} in:fade={{ duration: 200 }}>
      <div class="flex flex-col place-content-center place-items-center gap-6">
        <Text class="text-center">{$t('mfa_scan_qr_code')}</Text>
        <Qrcode value={setup.otpauthUri} width={200} />
        <Field label={$t('mfa_secret_key')} class="w-full max-w-sm">
          <HStack gap={1}>
            <Input value={setup.secret} readonly class="font-mono" />
            <IconButton
              variant="ghost"
              shape="round"
              color="secondary"
              icon={mdiContentCopy}
              onclick={() => setup && copyToClipboard(setup.secret)}
              aria-label={$t('copy_to_clipboard')}
            />
          </HStack>
        </Field>
        <Field label={$t('mfa_code')}>
          <PinInput bind:value={code} />
        </Field>
      </div>
      <div class="mt-4 flex justify-end gap-2">
        <Button shape="round" color="secondary" type="button" size="small" onclick={() => (setup = undefined)}>
          {$t('cancel')}
        </Button>
        <Button shape="round" type="submit" size="small" loading={isLoading} disabled={code.length !== 6}>
          {$t('enable')}
        </Button>
      </div>
    </form>
  {:else if isLoaded}
    <div class="flex justify-end" in:fade={{ duration: 200 }}>
      <Button shape="round" size="small" loading={isLoading} onclick={handleSetup}>{$t('mfa_set_up')}</Button>
    </div>
  {/if}
</section>
