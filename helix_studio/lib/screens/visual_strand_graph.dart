import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../models/graph_model.dart';
import 'dart:math' as math;

class VisualStrandGraph extends StatefulWidget {
  const VisualStrandGraph({super.key});

  @override
  State<VisualStrandGraph> createState() => _VisualStrandGraphState();
}

class _VisualStrandGraphState extends State<VisualStrandGraph> {
  // Dummy Initial Data
  final List<GraphNode> _nodes = [
    GraphNode(
      id: '1',
      label: 'User',
      type: 'model',
      position: const Offset(100, 100),
      outputs: ['posts', 'comments'],
    ),
    GraphNode(
      id: '2',
      label: 'Post',
      type: 'model',
      position: const Offset(400, 200),
      inputs: ['author'],
      outputs: ['comments'],
    ),
    GraphNode(
      id: '3',
      label: 'Comment',
      type: 'model',
      position: const Offset(700, 300),
      inputs: ['post', 'author'],
    ),
  ];

  final List<GraphEdge> _edges = [
    GraphEdge(fromNodeId: '1', toNodeId: '2'),
    GraphEdge(fromNodeId: '1', toNodeId: '3'),
    GraphEdge(fromNodeId: '2', toNodeId: '3'),
  ];

  Offset _offset = Offset.zero;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF050505), // Deepest Black
      body: GestureDetector(
        onPanUpdate: (details) {
          setState(() {
            _offset += details.delta;
          });
        },
        child: Stack(
          children: [
            // Grid Background
            CustomPaint(
              size: Size.infinite,
              painter: GridPainter(offset: _offset),
            ),
            
            // Edges (Behind nodes)
            CustomPaint(
              size: Size.infinite,
              painter: ConnectionPainter(
                nodes: _nodes,
                edges: _edges,
                offset: _offset,
              ),
            ),

            // Draggable Nodes
            ..._nodes.map((node) {
              return Positioned(
                left: node.position.dx + _offset.dx,
                top: node.position.dy + _offset.dy,
                child: GestureDetector(
                  onPanUpdate: (details) {
                    setState(() {
                      node.position += details.delta;
                    });
                  },
                  child: _buildNodeCard(node),
                ),
              );
            }),
            
            // HUD Overlay
            Positioned(
              bottom: 20,
              right: 20,
              child: FloatingActionButton.extended(
                backgroundColor: const Color(0xFFFFD700),
                foregroundColor: Colors.black,
                icon: const Icon(Icons.add),
                label: const Text("Add Strand"),
                onPressed: () {
                   setState(() {
                     _nodes.add(GraphNode(
                       id: DateTime.now().toString(),
                       label: 'New Strand',
                       type: 'model',
                       position: const Offset(300, 300) - _offset,
                     ));
                   });
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildNodeCard(GraphNode node) {
    return Container(
      width: 160,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: const Color(0xFF0a0a12).withOpacity(0.9),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFFFD700).withOpacity(0.5), width: 1),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFFFFD700).withOpacity(0.1),
            blurRadius: 15,
            spreadRadius: 2,
          ),
        ],
      ),
      child: Column(
        children: [
          Row(
            children: [
               const Icon(Icons.dataset, color: Color(0xFFFFD700), size: 16),
               const SizedBox(width: 8),
               Text(
                 node.label,
                 style: GoogleFonts.firaCode(
                   color: Colors.white,
                   fontWeight: FontWeight.bold,
                   fontSize: 14,
                 ),
               ),
            ],
          ),
          const Divider(color: Color(0xFF333333)),
          if(node.inputs.isNotEmpty) ...[
            Align(alignment: Alignment.centerLeft, child: Text('Inputs:', style: TextStyle(color: Colors.grey[600], fontSize: 10))),
             ...node.inputs.map((e) => Align(alignment: Alignment.centerLeft, child: Text("• $e", style: GoogleFonts.firaCode(color: Colors.grey, fontSize: 11)))),
          ],
          if(node.outputs.isNotEmpty) ...[
            const SizedBox(height: 4),
            Align(alignment: Alignment.centerRight, child: Text('Outputs:', style: TextStyle(color: Colors.grey[600], fontSize: 10))),
             ...node.outputs.map((e) => Align(alignment: Alignment.centerRight, child: Text("$e •", style: GoogleFonts.firaCode(color: Colors.grey, fontSize: 11)))),
          ]
        ],
      ),
    );
  }
}

class ConnectionPainter extends CustomPainter {
  final List<GraphNode> nodes;
  final List<GraphEdge> edges;
  final Offset offset;

  ConnectionPainter({required this.nodes, required this.edges, required this.offset});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = const Color(0xFFFFD700).withOpacity(0.6)
      ..strokeWidth = 2
      ..style = PaintingStyle.stroke;

    for (final edge in edges) {
      final from = nodes.firstWhere((n) => n.id == edge.fromNodeId);
      final to = nodes.firstWhere((n) => n.id == edge.toNodeId);

      final p1 = from.position + const Offset(160, 40) + offset; // Right center of card roughly
      final p2 = to.position + const Offset(0, 40) + offset; // Left center

      final path = Path();
      path.moveTo(p1.dx, p1.dy);
      
      // Bezier Curve
      final controlPoint1 = Offset(p1.dx + 50, p1.dy);
      final controlPoint2 = Offset(p2.dx - 50, p2.dy);
      
      path.cubicTo(controlPoint1.dx, controlPoint1.dy, controlPoint2.dx, controlPoint2.dy, p2.dx, p2.dy);

      canvas.drawPath(path, paint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => true;
}

class GridPainter extends CustomPainter {
  final Offset offset;

  GridPainter({required this.offset});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = const Color(0xFF1a1a2e)
      ..strokeWidth = 1;

    const gap = 40.0;
    
    // Calculate start based on offset so grid feels infinite
    final startX = (offset.dx % gap) - gap;
    final startY = (offset.dy % gap) - gap;

    for (double i = startX; i < size.width; i += gap) {
      canvas.drawLine(Offset(i, 0), Offset(i, size.height), paint);
    }
    for (double i = startY; i < size.height; i += gap) {
      canvas.drawLine(Offset(0, i), Offset(size.width, i), paint);
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => true;
}
