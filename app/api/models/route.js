import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    models: [
      { id: 'black-forest-labs/flux-2-pro', name: 'Flux 2 Pro', desc: 'Best quality, premium tier' },
      { id: 'black-forest-labs/flux-2-dev', name: 'Flux 2 Dev', desc: 'High quality, balanced' },
      { id: 'black-forest-labs/flux-2-flex', name: 'Flux 2 Flex', desc: 'Fast and flexible' },
      { id: 'black-forest-labs/flux-2-klein', name: 'Flux 2 Klein', desc: 'Ultra fast, compact' },
    ],
  });
}
