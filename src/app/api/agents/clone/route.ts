import { NextRequest, NextResponse } from 'next/server';
import { execFileSync } from 'child_process';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { prisma } from '@/lib/prisma';
import { scanRepository } from '@/lib/security';

const ALLOWED_HOSTS = ['github.com', 'gitlab.com', 'bitbucket.org'];
const CLONE_TIMEOUT = 30_000;

export async function POST(request: NextRequest) {
  // Auth
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const apiKey = authHeader.slice(7);
  const user = await prisma.user.findUnique({ where: { apiKey } });
  if (!user || (user.role !== 'provider' && user.role !== 'admin')) {
    return NextResponse.json({ error: 'Provider account required' }, { status: 403 });
  }

  let tmpDir: string | null = null;

  try {
    const body = await request.json();
    const { repoUrl, name, category, description } = body;

    if (!repoUrl || typeof repoUrl !== 'string') {
      return NextResponse.json({ error: 'repoUrl is required' }, { status: 400 });
    }

    // Validate URL is HTTPS from allowed hosts
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(repoUrl);
    } catch {
      return NextResponse.json({ error: 'Invalid URL format' }, { status: 422 });
    }

    if (parsedUrl.protocol !== 'https:') {
      return NextResponse.json({ error: 'Only HTTPS repository URLs are accepted' }, { status: 422 });
    }

    if (!ALLOWED_HOSTS.includes(parsedUrl.hostname)) {
      return NextResponse.json(
        { error: `Repository must be hosted on: ${ALLOWED_HOSTS.join(', ')}` },
        { status: 422 },
      );
    }

    // Clone to temp directory
    tmpDir = mkdtempSync(join(tmpdir(), 'hoa-repo-'));

    try {
      execFileSync('git', ['clone', '--depth', '1', '--single-branch', repoUrl, tmpDir], {
        timeout: CLONE_TIMEOUT,
        stdio: 'pipe',
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      return NextResponse.json(
        { error: `Failed to clone repository: ${message.includes('timeout') ? 'Clone timed out (30s)' : 'Repository not accessible'}` },
        { status: 422 },
      );
    }

    // Detect project type
    const hasPackageJson = existsSync(join(tmpDir, 'package.json'));
    const hasRequirements = existsSync(join(tmpDir, 'requirements.txt'));
    const hasDockerfile = existsSync(join(tmpDir, 'Dockerfile'));
    const hasReadme = existsSync(join(tmpDir, 'README.md'));

    let projectType: 'node' | 'python' | 'docker' | 'unknown' = 'unknown';
    if (hasDockerfile) projectType = 'docker';
    else if (hasPackageJson) projectType = 'node';
    else if (hasRequirements) projectType = 'python';

    // Extract metadata from package.json or README
    let extractedName = name;
    let extractedDescription = description;
    const dependencies: string[] = [];

    if (hasPackageJson) {
      try {
        const pkg = JSON.parse(readFileSync(join(tmpDir, 'package.json'), 'utf8'));
        if (!extractedName && pkg.name) extractedName = pkg.name;
        if (!extractedDescription && pkg.description) extractedDescription = pkg.description;
        if (pkg.dependencies) dependencies.push(...Object.keys(pkg.dependencies));
      } catch {}
    }

    if (!extractedDescription && hasReadme) {
      try {
        const readme = readFileSync(join(tmpDir, 'README.md'), 'utf8');
        extractedDescription = readme.slice(0, 500).replace(/^#.*\n/, '').trim();
      } catch {}
    }

    // Security scan
    const securityScan = await scanRepository(tmpDir);

    if (!securityScan.safe) {
      return NextResponse.json(
        {
          error: 'Repository failed security scan',
          riskScore: securityScan.riskScore,
          findings: securityScan.findings.map(f => ({
            type: f.type,
            severity: f.severity,
            description: f.description,
            location: f.location,
          })),
        },
        { status: 422 },
      );
    }

    return NextResponse.json({
      projectType,
      metadata: {
        name: extractedName || 'Unnamed Agent',
        description: extractedDescription || 'No description available',
        category: category || 'other',
        dependencies: dependencies.slice(0, 20),
      },
      securityScan: {
        safe: securityScan.safe,
        riskScore: securityScan.riskScore,
        findingsCount: securityScan.findings.length,
      },
      message: 'Repository scanned successfully. Proceed with agent registration.',
    });
  } catch (error) {
    console.error('[POST /api/agents/clone]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  } finally {
    // Always clean up temp directory
    if (tmpDir) {
      try {
        rmSync(tmpDir, { recursive: true, force: true });
      } catch {}
    }
  }
}
