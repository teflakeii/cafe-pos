export type AdminSettings = {
  app: {
    name: string;
    environment: string;
  };
  api: {
    port: number;
    corsOrigins: string[];
  };
  auth: {
    jwtExpiryHours: number;
  };
  pos: {
    allowCashierOpenShift: boolean;
    requiresOpenShiftForOrders: boolean;
  };
};
