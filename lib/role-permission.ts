import { createAccessControl } from "better-auth/plugins/access";

// list of permission statement
export const statement = {
    user: ['view', 'create', 'update', 'delete', 'ban', 'unban', 'list', 'set-role', 'set-password', 'set-email'],
    item_category: ['view', 'create', 'update', 'delete', 'restore', 'force-delete'],
    item: ['view', 'create', 'update', 'delete', 'restore', 'force-delete'],
    inventory: ['view', 'record-only', 'create', 'update', 'delete', 'restore', 'force-delete', 'approval'],
    distribution: ['view', 'record-only', 'create', 'update', 'delete', 'restore', 'force-delete', 'approval'],
} as const;

// initialize permission
export const accessControl = createAccessControl(statement);

// Role Initialize
export const admin = accessControl.newRole({
    user: ['view', 'create', 'update', 'delete', 'ban', 'unban', 'list', 'set-role', 'set-password', 'set-email'],
    item_category: ['view', 'create', 'update', 'delete', 'restore', 'force-delete'],
    item: ['view', 'create', 'update', 'delete', 'restore', 'force-delete'],
    inventory: ['view', 'record-only', 'create', 'update', 'delete', 'restore', 'force-delete', 'approval'],
    distribution: ['view', 'record-only', 'create', 'update', 'delete', 'restore', 'force-delete', 'approval'],
});

export const supervisor = accessControl.newRole({
    item_category: ['view', 'create', 'update', 'delete', 'restore', 'force-delete'],
    item: ['view', 'create', 'update', 'delete', 'restore', 'force-delete'],
    inventory: ['view', 'record-only', 'create', 'update', 'delete', 'restore', 'force-delete', 'approval'],
    distribution: ['view', 'record-only', 'create', 'update', 'delete', 'restore', 'force-delete', 'approval'],
});

export const staff = accessControl.newRole({
    inventory: ['view', 'record-only', 'create', 'update', 'delete', 'restore'],
    distribution: ['view', 'record-only', 'create', 'update', 'delete', 'restore'],
})
