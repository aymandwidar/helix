import 'package:flutter/material.dart';

class GraphNode {
  final String id;
  final String label;
  final String type; // 'model', 'api', 'view'
  Offset position;
  final List<String> inputs;
  final List<String> outputs;

  GraphNode({
    required this.id,
    required this.label,
    required this.type,
    required this.position,
    this.inputs = const [],
    this.outputs = const [],
  });
}

class GraphEdge {
  final String fromNodeId;
  final String toNodeId;
  final Color color;

  GraphEdge({
    required this.fromNodeId,
    required this.toNodeId,
    this.color = const Color(0xFFFFD700),
  });
}
