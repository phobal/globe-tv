import { syncFromDirectory } from './sync-core.mjs';

const input = process.argv[2];
const output = process.argv[3] ?? 'public/data';
if (!input) {
  console.error('用法：npm run sync -- <上游仓库目录> [输出目录]');
  process.exit(2);
}
try {
  const result = await syncFromDirectory(input, output, process.env.UPSTREAM_SHA ?? 'unknown');
  console.log(`同步完成：${result.countries} 个国家，${result.accepted} 个频道，跳过 ${result.rejected} 条`);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
