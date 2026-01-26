import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

void main() {
  runApp(
    ChangeNotifierProvider(
      create: (context) => ProtocolProvider(),
      child: const OperatorApp(),
    ),
  );
}

class Protocol {
  final String title;
  final String riskLevel;
  final String description;

  Protocol({
    required this.title,
    required this.riskLevel,
    required this.description,
  });
}

class ProtocolProvider extends ChangeNotifier {
  final List<Protocol> _protocols = [];
  List<Protocol> get protocols => _protocols;

  void addProtocol(Protocol protocol) {
    _protocols.add(protocol);
    notifyListeners();
  }

  void removeProtocol(int index) {
    _protocols.removeAt(index);
    notifyListeners();
  }
}

class OperatorApp extends StatelessWidget {
  const OperatorApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'Operator',
      theme: ThemeData(
        useMaterial3: true,
        scaffoldBackgroundColor: const Color(0xFF0a0a12),
        primaryColor: const Color(0xFFFFD700),
        cardColor: const Color(0xFF1a1a2e),
        colorScheme: const ColorScheme.dark(
          primary: Color(0xFFFFD700),
          surface: Color(0xFF1a1a2e),
        ),
        textTheme: const TextTheme(
          bodyLarge: TextStyle(color: Colors.white),
          bodyMedium: TextStyle(color: Colors.white70),
        ),
      ),
      home: const ProtocolScreen(),
    );
  }
}

class ProtocolScreen extends StatelessWidget {
  const ProtocolScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('OPERATOR',
            style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        backgroundColor: const Color(0xFF1a1a2e),
      ),
      body: Consumer<ProtocolProvider>(
        builder: (context, protocolProvider, child) {
          return ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: protocolProvider.protocols.length,
            itemBuilder: (context, index) {
              final protocol = protocolProvider.protocols[index];
              return Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Card(
                  elevation: 8,
                  child: InkWell(
                    onLongPress: () {
                      protocolProvider.removeProtocol(index);
                    },
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                protocol.title,
                                style: const TextStyle(
                                  color: Color(0xFFFFD700),
                                  fontSize: 18,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 8, vertical: 4),
                                decoration: BoxDecoration(
                                  color: const Color(0xFF0a0a12),
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: Text(
                                  protocol.riskLevel,
                                  style: const TextStyle(
                                    color: Colors.white70,
                                    fontSize: 12,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Text(
                            protocol.description,
                            style: const TextStyle(color: Colors.white70),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              );
            },
          );
        },
      ),
      floatingActionButton: FloatingActionButton(
        backgroundColor: const Color(0xFFFFD700),
        child: const Icon(Icons.add, color: Color(0xFF0a0a12)),
        onPressed: () {
          showModalBottomSheet(
            context: context,
            isScrollControlled: true,
            backgroundColor: const Color(0xFF1a1a2e),
            builder: (context) => const AddProtocolSheet(),
          );
        },
      ),
    );
  }
}

class AddProtocolSheet extends StatefulWidget {
  const AddProtocolSheet({super.key});

  @override
  AddProtocolSheetState createState() => AddProtocolSheetState();
}

class AddProtocolSheetState extends State<AddProtocolSheet> {
  final _titleController = TextEditingController();
  final _riskController = TextEditingController();
  final _descriptionController = TextEditingController();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.fromLTRB(
        16,
        16,
        16,
        MediaQuery.of(context).viewInsets.bottom + 16,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            'New Protocol',
            style: TextStyle(
              color: Color(0xFFFFD700),
              fontSize: 20,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _titleController,
            style: const TextStyle(color: Colors.white),
            decoration: const InputDecoration(
              labelText: 'Title',
              labelStyle: TextStyle(color: Colors.white70),
              enabledBorder: OutlineInputBorder(
                borderSide: BorderSide(color: Colors.white24),
              ),
              focusedBorder: OutlineInputBorder(
                borderSide: BorderSide(color: Color(0xFFFFD700)),
              ),
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _riskController,
            style: const TextStyle(color: Colors.white),
            decoration: const InputDecoration(
              labelText: 'Risk Level',
              labelStyle: TextStyle(color: Colors.white70),
              enabledBorder: OutlineInputBorder(
                borderSide: BorderSide(color: Colors.white24),
              ),
              focusedBorder: OutlineInputBorder(
                borderSide: BorderSide(color: Color(0xFFFFD700)),
              ),
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _descriptionController,
            style: const TextStyle(color: Colors.white),
            maxLines: 3,
            decoration: const InputDecoration(
              labelText: 'Description',
              labelStyle: TextStyle(color: Colors.white70),
              enabledBorder: OutlineInputBorder(
                borderSide: BorderSide(color: Colors.white24),
              ),
              focusedBorder: OutlineInputBorder(
                borderSide: BorderSide(color: Color(0xFFFFD700)),
              ),
            ),
          ),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFFFD700),
                foregroundColor: const Color(0xFF0a0a12),
                padding: const EdgeInsets.symmetric(vertical: 16),
              ),
              onPressed: () {
                if (_titleController.text.isNotEmpty &&
                    _riskController.text.isNotEmpty &&
                    _descriptionController.text.isNotEmpty) {
                  context.read<ProtocolProvider>().addProtocol(
                        Protocol(
                          title: _titleController.text,
                          riskLevel: _riskController.text,
                          description: _descriptionController.text,
                        ),
                      );
                  Navigator.pop(context);
                }
              },
              child: const Text('Add Protocol',
                  style: TextStyle(fontWeight: FontWeight.bold)),
            ),
          ),
        ],
      ),
    );
  }

  @override
  void dispose() {
    _titleController.dispose();
    _riskController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }
}