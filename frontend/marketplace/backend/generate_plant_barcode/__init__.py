# generate_plant_barcode/__init__.py
import logging
import azure.functions as func
import json
import io
import os
import base64
from azure.cosmos import CosmosClient
from reportlab.lib.pagesizes import letter
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.graphics.shapes import Drawing
from reportlab.graphics.barcode import qr
from reportlab.lib.units import inch, cm

def main(req: func.HttpRequest) -> func.HttpResponse:
    logging.info('Generate Plant Barcode API triggered.')
    
    # Get plant ID
    plant_id = req.params.get('plantId')
    business_id = req.params.get('businessId')
    
    if not plant_id or not business_id:
        return func.HttpResponse(
            json.dumps({"error": "Plant ID and Business ID are required"}),
            status_code=400,
            mimetype="application/json"
        )
    
    # Initialize Cosmos client
    try:
        endpoint = os.environ["COSMOSDB__MARKETPLACE_CONNECTION_STRING"]
        key = os.environ["COSMOSDB_KEY"]
        database_id = os.environ["COSMOSDB_MARKETPLACE_DATABASE_NAME"]
        container_id = "inventory"
        
        client = CosmosClient(endpoint, key)
        database = client.get_database_client(database_id)
        container = database.get_container_client(container_id)
        
        # Get plant data
        try:
            plant = container.read_item(item=plant_id, partition_key=business_id)
        except Exception as e:
            return func.HttpResponse(
                json.dumps({"error": f"Plant not found: {str(e)}"}),
                status_code=404,
                mimetype="application/json"
            )
        
        # Generate PDF with barcode
        pdf_data = generate_barcode_pdf(plant)
        
        # Return PDF data
        return func.HttpResponse(
            pdf_data,
            status_code=200,
            mimetype="application/pdf",
            headers={
                "Content-Disposition": f"attachment; filename=plant_barcode_{plant_id}.pdf"
            }
        )
    
    except Exception as e:
        logging.error(f"Error generating barcode: {str(e)}")
        return func.HttpResponse(
            json.dumps({"error": f"Internal server error: {str(e)}"}),
            status_code=500,
            mimetype="application/json"
        )

def generate_barcode_pdf(plant):
    """Generate PDF with plant info and QR code"""
    try:
        # Create a file-like buffer to receive PDF data
        buffer = io.BytesIO()
        
        # Create the PDF object
        doc = SimpleDocTemplate(buffer, pagesize=letter)
        styles = getSampleStyleSheet()
        
        # Add custom styles
        styles.add(ParagraphStyle(
            name='Title',
            parent=styles['Heading1'],
            fontSize=16,
            spaceAfter=12
        ))
        
        styles.add(ParagraphStyle(
            name='PlantName',
            parent=styles['Heading2'],
            fontSize=14,
            spaceAfter=6
        ))
        
        styles.add(ParagraphStyle(
            name='ScientificName',
            parent=styles['Normal'],
            fontName='Helvetica-Oblique',
            fontSize=12,
            spaceAfter=12
        ))
        
        # Start building PDF content
        story = []
        
        # Add title
        story.append(Paragraph("Plant Information Card", styles['Title']))
        story.append(Spacer(1, 0.2*inch))
        
        # Add plant name
        plant_name = plant.get('name') or plant.get('common_name') or "Unknown Plant"
        story.append(Paragraph(plant_name, styles['PlantName']))
        
        # Add scientific name if available
        scientific_name = plant.get('scientificName') or plant.get('scientific_name')
        if scientific_name:
            story.append(Paragraph(scientific_name, styles['ScientificName']))
        
        # Add QR code
        # Create QR code data
        qr_data = {
            "type": "plant",
            "id": plant['id'],
            "name": plant_name,
            "businessId": plant['businessId'],
            "barcode": plant.get('barcode', f"PLT-{plant['id']}")
        }
        
        # Add care information if available
        care_info = []
        
        if 'water_days' in plant or ('wateringSchedule' in plant and 'waterDays' in plant['wateringSchedule']):
            water_days = plant.get('wateringSchedule', {}).get('waterDays', plant.get('water_days', 7))
            care_info.append(["Watering:", f"Every {water_days} days"])
        
        if 'light' in plant:
            care_info.append(["Light:", plant['light']])
        
        if 'humidity' in plant:
            care_info.append(["Humidity:", plant['humidity']])
        
        if 'temperature' in plant:
            care_info.append(["Temperature:", plant['temperature']])
        
        if 'difficulty' in plant:
            care_info.append(["Difficulty:", f"{plant['difficulty']}/10"])
        
        # Add care information table
        if care_info:
            story.append(Spacer(1, 0.2*inch))
            story.append(Paragraph("Care Information", styles['Heading3']))
            
            care_table = Table(care_info, colWidths=[1.5*inch, 3*inch])
            care_table.setStyle(TableStyle([
                ('TEXTCOLOR', (0, 0), (-1, -1), colors.black),
                ('ALIGN', (0, 0), (0, -1), 'RIGHT'),
                ('ALIGN', (1, 0), (1, -1), 'LEFT'),
                ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
                ('TOPPADDING', (0, 0), (-1, -1), 3),
                ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
            ]))
            
            story.append(care_table)
        
        # Create QR code
        story.append(Spacer(1, 0.3*inch))
        story.append(Paragraph("Scan for more information:", styles['Normal']))
        
        qr_code = qr.QrCodeWidget(json.dumps(qr_data))
        qr_drawing = Drawing(2*inch, 2*inch, transform=[2*inch/qr_code.barWidth, 0, 0, 2*inch/qr_code.barHeight, 0, 0])
        qr_drawing.add(qr_code)
        story.append(qr_drawing)
        
        # Add barcode number
        barcode_value = plant.get('barcode', f"PLT-{plant['id']}")
        story.append(Paragraph(f"Plant ID: {barcode_value}", styles['Normal']))
        
        # Build the PDF
        doc.build(story)
        
        # Get the PDF value from the buffer
        pdf_data = buffer.getvalue()
        buffer.close()
        
        return pdf_data
    
    except Exception as e:
        logging.error(f"Error generating PDF: {str(e)}")
        raise