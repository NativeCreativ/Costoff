import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

export async function GET() {
  try {
    const clients = await prisma.clients.findMany({
      orderBy: { created_at: 'desc' },
    });

    if (!clients || clients.length === 0) {
      const sampleClients = [
        { id: '1', name: 'Costaff Enterprise Account A', industry: 'Information Technology', location: 'Bangalore', notes: 'Key Strategic Client — SLA 30 Days' },
        { id: '2', name: 'Costaff Financial Services B', industry: 'Banking & BFSI', location: 'Mumbai', notes: 'High Volume Contracting' },
        { id: '3', name: 'Costaff Cloud Tech C', industry: 'Cloud & SaaS', location: 'Hyderabad', notes: 'Exclusive Retainer Client' },
      ];
      return NextResponse.json({ clients: sampleClients });
    }

    return NextResponse.json({ clients: clients || [] });
  } catch (error) {
    console.error('Error in GET /api/clients:', error);
    return NextResponse.json({ clients: [] }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const newClient = {
      name: body.name || 'New Client Account',
      industry: body.industry || 'Technology',
      location: body.location || 'Pan India',
      notes: body.notes || ''
    };

    const client = await prisma.clients.create({ data: newClient });

    return NextResponse.json({ client, success: true });
  } catch (error) {
    console.error('Error in POST /api/clients:', error);
    return NextResponse.json({ error: 'Failed to create client' }, { status: 500 });
  }
}
