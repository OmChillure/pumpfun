import { NextResponse, NextRequest } from 'next/server';
import clientPromise from '@/utils/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const query = searchParams.get('q');

        if (!query) {
            return NextResponse.json(
                { success: false, error: 'Search query is required' },
                { status: 400 }
            );
        }

        const client = await clientPromise;
        const db = client.db("tokenDb");
        
        const tokens = await db.collection('tokens').find({
            $or: [
                { name: { $regex: query, $options: 'i' } },
                { symbol: { $regex: query, $options: 'i' } }
            ]
        }).toArray();

        return NextResponse.json({
            success: true,
            data: tokens,
            count: tokens.length
        });
    } catch (error) {
        console.error('Failed to search tokens:', error);
        return NextResponse.json(
            { 
                success: false, 
                error: 'Failed to search tokens',
                message: error instanceof Error ? error.message : 'Unknown error'
            },
            { status: 500 }
        );
    }
}