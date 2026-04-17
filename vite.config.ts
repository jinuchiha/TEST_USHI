import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => {
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        rollupOptions: {
          output: {
            manualChunks(id) {
              // Vendor: Recharts + D3
              if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-') || id.includes('node_modules/victory-')) {
                return 'vendor-recharts';
              }
              // Vendor: React ecosystem
              if (id.includes('node_modules/react') || id.includes('node_modules/scheduler')) {
                return 'vendor-react';
              }
              // AI engines
              if (id.includes('/src/ai/')) {
                return 'ai-engines';
              }
              // Cases + case detail sub-components
              if (id.includes('/components/cases/')) {
                return 'cases';
              }
              // Dashboards + AI views
              if (id.includes('/components/dashboard/') || id.includes('/components/ai/')) {
                return 'dashboards';
              }
              // Reports + debtor portal
              if (id.includes('/components/reports/') || id.includes('/components/debtor-portal/')) {
                return 'reports';
              }
              // HR, Automation, Productivity, Gulf
              if (id.includes('/components/hr/') || id.includes('/components/automation/') || id.includes('/components/productivity/') || id.includes('/components/gulf/')) {
                return 'hr-automation';
              }
            },
          },
        },
      },
    };
});
