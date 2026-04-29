import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { TenantPrismaService } from '../prisma/tenant-prisma.service';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import * as PDFDocument from 'pdfkit';
import { PassThrough } from 'stream';

@Injectable()
export class InvoicesService {
  private readonly logger = new Logger(InvoicesService.name);
  private s3Client: S3Client;
  private readonly bucketName = process.env.MINIO_BUCKET_NAME || 'nexos-bucket';

  constructor(private readonly prisma: TenantPrismaService) {
    this.s3Client = new S3Client({
      endpoint: process.env.MINIO_ENDPOINT || 'http://localhost:9000',
      region: 'us-east-1', // Required by S3 SDK, MinIO ignores it or uses us-east-1
      credentials: {
        accessKeyId: process.env.MINIO_ACCESS_KEY || 'nexosadmin',
        secretAccessKey: process.env.MINIO_SECRET_KEY || 'nexospassword',
      },
      forcePathStyle: true, // Crucial for MinIO
    });
  }

  async generateForSale(saleId: string) {
    const tenantId = this.prisma.currentTenantId;

    const sale = await this.prisma.global.sale.findUnique({
      where: { id: saleId, tenantId, deletedAt: null },
      include: {
        items: { include: { product: true } },
        customer: true,
      },
    });

    if (!sale) throw new NotFoundException('Sale not found');
    if (sale.status !== 'CONFIRMED') throw new BadRequestException('Can only generate invoice for CONFIRMED sales');

    const existingInvoice = await this.prisma.global.invoice.findFirst({
      where: { saleId, tenantId, deletedAt: null },
    });

    if (existingInvoice) {
      throw new BadRequestException('Invoice already generated for this sale');
    }

    // 1. Generate PDF
    const pdfBuffer = await this.createPdfBuffer(sale);

    // 2. Upload to MinIO
    const fileName = \`invoices/\${tenantId}/\${sale.number}.pdf\`;
    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: fileName,
        Body: pdfBuffer,
        ContentType: 'application/pdf',
      }),
    );

    // 3. Save to DB
    const invoiceNumber = \`INV-\${sale.number}\`;
    const invoice = await this.prisma.$transaction(async (tx) => {
      return tx.invoice.create({
        data: {
          tenantId,
          saleId,
          number: invoiceNumber,
          pdfPath: fileName,
          issuedAt: new Date(),
        },
      });
    });

    return invoice;
  }

  async getDownloadUrl(id: string) {
    const tenantId = this.prisma.currentTenantId;
    const invoice = await this.prisma.global.invoice.findUnique({
      where: { id, tenantId, deletedAt: null },
    });

    if (!invoice || !invoice.pdfPath) {
      throw new NotFoundException('Invoice or PDF not found');
    }

    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: invoice.pdfPath,
    });

    const url = await getSignedUrl(this.s3Client, command, { expiresIn: 3600 });
    return { url };
  }

  async findAll() {
    return this.prisma.$transaction(async (tx) => {
      return tx.invoice.findMany({
        where: { tenantId: this.prisma.currentTenantId, deletedAt: null },
        orderBy: { issuedAt: 'desc' },
      });
    });
  }

  private createPdfBuffer(sale: any): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const buffers: Buffer[] = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));
      doc.on('error', reject);

      // Simple PDF content
      doc.fontSize(20).text('Invoice', { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(\`Sale Number: \${sale.number}\`);
      doc.text(\`Date: \${new Date().toLocaleDateString()}\`);
      doc.text(\`Customer: \${sale.customer?.name || 'N/A'}\`);
      doc.moveDown();

      doc.text('Items:');
      sale.items.forEach(item => {
        doc.text(\`- \${item.product?.name || 'Unknown'} x \${item.quantity} = $\${item.subtotal}\`);
      });

      doc.moveDown();
      doc.fontSize(14).text(\`Subtotal: $\${sale.subtotal}\`);
      doc.text(\`Tax: $\${sale.tax}\`);
      doc.text(\`Total: $\${sale.total}\`);

      doc.end();
    });
  }
}
