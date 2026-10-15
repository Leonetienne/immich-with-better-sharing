import { BadRequestException, Injectable } from '@nestjs/common';
import { Stack } from 'src/database.js';
import { BulkIdsDto } from 'src/dtos/asset-ids.response.dto.js';
import { AuthDto } from 'src/dtos/auth.dto.js';
import { StackCreateDto, StackResponseDto, StackSearchDto, StackUpdateDto, mapStack } from 'src/dtos/stack.dto.js';
import { Permission } from 'src/enum.js';
import { BaseService } from 'src/services/base.service.js';
import { findOrFail } from 'src/utils/misc.js';
import { UUIDAssetIDParamDto } from 'src/validation.js';

@Injectable()
export class StackService extends BaseService {
  async search(auth: AuthDto, dto: StackSearchDto): Promise<StackResponseDto[]> {
    const stacks = await this.stackRepository.search({
      ownerId: auth.user.id,
      primaryAssetId: dto.primaryAssetId,
    });

    return Promise.all(stacks.map((stack) => this.mapVisible(auth, stack)));
  }

  async create(auth: AuthDto, dto: StackCreateDto): Promise<StackResponseDto> {
    const ownerId = await this.requireStackCreateAccess(auth, dto.assetIds);

    const stack = await this.stackRepository.create({ ownerId }, dto.assetIds);

    await this.eventRepository.emit('StackCreate', { stackId: stack.id, userId: auth.user.id });

    return this.mapVisible(auth, stack);
  }

  async get(auth: AuthDto, id: string): Promise<StackResponseDto> {
    await this.requireAccess({ auth, permission: Permission.StackRead, ids: [id] });
    const stack = await this.findOrFail(id);
    return this.mapVisible(auth, stack);
  }

  async update(auth: AuthDto, id: string, dto: StackUpdateDto): Promise<StackResponseDto> {
    await this.requireAccess({ auth, permission: Permission.StackUpdate, ids: [id] });
    const stack = await this.findOrFail(id);
    if (dto.primaryAssetId && stack.assets.every(({ id }) => id !== dto.primaryAssetId)) {
      throw new BadRequestException('Primary asset must be in the stack');
    }

    const updatedStack = await this.stackRepository.update(id, { id, primaryAssetId: dto.primaryAssetId });

    await this.eventRepository.emit('StackUpdate', { stackId: id, userId: auth.user.id });

    return this.mapVisible(auth, updatedStack);
  }

  async delete(auth: AuthDto, id: string): Promise<void> {
    await this.requireAccess({ auth, permission: Permission.StackDelete, ids: [id] });
    await this.stackRepository.delete(id);
    await this.eventRepository.emit('StackDelete', { stackId: id, userId: auth.user.id });
  }

  async deleteAll(auth: AuthDto, dto: BulkIdsDto): Promise<void> {
    await this.requireAccess({ auth, permission: Permission.StackDelete, ids: dto.ids });
    await this.stackRepository.deleteAll(dto.ids);
    await this.eventRepository.emit('StackDeleteAll', { stackIds: dto.ids, userId: auth.user.id });
  }

  async removeAsset(auth: AuthDto, dto: UUIDAssetIDParamDto): Promise<void> {
    const { id: stackId, assetId } = dto;
    await this.requireAccess({ auth, permission: Permission.StackUpdate, ids: [stackId] });

    const stack = await this.stackRepository.getForAssetRemoval(assetId);

    if (!stack?.id || stack.id !== stackId) {
      throw new BadRequestException('Asset not in stack');
    }

    if (stack.primaryAssetId === assetId) {
      throw new BadRequestException("Cannot remove stack's primary asset");
    }

    await this.assetRepository.update({ id: assetId, stackId: null });
    await this.eventRepository.emit('StackUpdate', { stackId, userId: auth.user.id });
  }

  // Editable assets stack freely across owners. Otherwise partners may only stack one partner's assets.
  // The stack belongs to the owner of the first (primary) asset.
  private async requireStackCreateAccess(auth: AuthDto, assetIds: string[]): Promise<string> {
    const ids = new Set(assetIds);
    const editable = await this.checkAccess({ auth, permission: Permission.AssetUpdate, ids });
    const assets = await this.assetRepository.getByIds(assetIds);
    const primary = assets.find(({ id }) => id === assetIds[0]);

    if (editable.size === ids.size && primary) {
      return primary.ownerId;
    }

    const partner = auth.sharedLink
      ? new Set<string>()
      : await this.accessRepository.asset.checkPartnerAccess(auth.user.id, ids);
    if (partner.size !== ids.size || !primary) {
      throw new BadRequestException(`Not found or no ${Permission.AssetUpdate} access`);
    }

    if (new Set(assets.map(({ ownerId }) => ownerId)).size !== 1) {
      throw new BadRequestException('Stack assets must belong to a single owner');
    }

    return primary.ownerId;
  }

  // Mixed-owner stacks may contain assets the viewer has no access to.
  private async mapVisible(auth: AuthDto, stack: Stack): Promise<StackResponseDto> {
    const ids = stack.assets.map(({ id }) => id);
    const readable = await this.checkAccess({ auth, permission: Permission.AssetRead, ids });
    return mapStack({ ...stack, assets: stack.assets.filter(({ id }) => readable.has(id)) }, { auth });
  }

  private findOrFail(id: string) {
    return findOrFail(() => this.stackRepository.getById(id), 'Asset stack');
  }
}
