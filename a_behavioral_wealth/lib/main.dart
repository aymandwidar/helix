import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'dart:collection';

class Asset {
  final String ticker;
  final String name;
  final double value;
  final String category;
  final String sentiment;
  final List<DecisionLog> decisions;

  Asset({
    required this.ticker,
    required this.name,
    required this.value,
    required this.category,
    required this.sentiment,
    this.decisions = const [],
  });
}

class DecisionLog {
  final DateTime date;
  final String type;
  final String rationale;
  final String emotionalState;

  DecisionLog({
    required this.date,
    required this.type,
    required this.rationale,
    required this.emotionalState,
  });
}

class CitadelState extends ChangeNotifier {
  final List<Asset> _assets = [];
  UnmodifiableListView<Asset> get assets => UnmodifiableListView(_assets);

  void addAsset(Asset asset) {
    _assets.add(asset);
    notifyListeners();
  }

  void removeAsset(Asset asset) {
    _assets.remove(asset);
    notifyListeners();
  }

  void addDecision(Asset asset, DecisionLog decision) {
    final index = _assets.indexOf(asset);
    if (index != -1) {
      final updatedAsset = Asset(
        ticker: asset.ticker,
        name: asset.name,
        value: asset.value,
        category: asset.category,
        sentiment: asset.sentiment,
        decisions: [...asset.decisions, decision],
      );
      _assets[index] = updatedAsset;
      notifyListeners();
    }
  }
}

void main() {
  runApp(
    ChangeNotifierProvider(
      create: (context) => CitadelState(),
      child: const CitadelApp(),
    ),
  );
}

class CitadelApp extends StatelessWidget {
  const CitadelApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Citadel',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        brightness: Brightness.dark,
        scaffoldBackgroundColor: const Color(0xFF0a0a12),
        primaryColor: const Color(0xFFFFD700),
        cardColor: const Color(0xFF1a1a2e),
        textTheme: const TextTheme(
          bodyLarge: TextStyle(color: Colors.white),
          bodyMedium: TextStyle(color: Colors.white70),
        ),
      ),
      home: const CitadelDashboard(),
    );
  }
}

class CitadelDashboard extends StatelessWidget {
  const CitadelDashboard({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Citadel',
            style: TextStyle(color: Color(0xFFFFD700), fontWeight: FontWeight.bold)),
        backgroundColor: const Color(0xFF1a1a2e),
      ),
      body: Consumer<CitadelState>(
        builder: (context, state, child) {
          return ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: state.assets.length,
            itemBuilder: (context, index) {
              final asset = state.assets[index];
              return AssetCard(asset: asset);
            },
          );
        },
      ),
      floatingActionButton: FloatingActionButton(
        backgroundColor: const Color(0xFFFFD700),
        child: const Icon(Icons.add, color: Color(0xFF0a0a12)),
        onPressed: () => _showAddAssetSheet(context),
      ),
    );
  }

  void _showAddAssetSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF1a1a2e),
      builder: (context) => const AddAssetForm(),
    );
  }
}

class AssetCard extends StatelessWidget {
  final Asset asset;

  const AssetCard({super.key, required this.asset});

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 16),
      child: InkWell(
        onLongPress: () {
          context.read<CitadelState>().removeAsset(asset);
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
                    asset.ticker,
                    style: const TextStyle(
                      color: Color(0xFFFFD700),
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  Text(
                    '\$${asset.value.toStringAsFixed(2)}',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 18,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                asset.name,
                style: const TextStyle(color: Colors.white70),
              ),
              const SizedBox(height: 8),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    asset.category,
                    style: const TextStyle(color: Colors.white70),
                  ),
                  Text(
                    asset.sentiment,
                    style: TextStyle(
                      color: asset.sentiment == 'Bullish'
                          ? Colors.green
                          : Colors.red,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class AddAssetForm extends StatefulWidget {
  const AddAssetForm({super.key});

  @override
  AddAssetFormState createState() => AddAssetFormState();
}

class AddAssetFormState extends State<AddAssetForm> {
  final _formKey = GlobalKey<FormState>();
  String ticker = '';
  String name = '';
  double value = 0;
  String category = 'Equity';
  String sentiment = 'Bullish';

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
        left: 16,
        right: 16,
        top: 16,
      ),
      child: Form(
        key: _formKey,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextFormField(
              decoration: const InputDecoration(
                labelText: 'Ticker',
                labelStyle: TextStyle(color: Colors.white70),
              ),
              style: const TextStyle(color: Colors.white),
              onChanged: (value) => ticker = value,
              validator: (value) =>
                  value?.isEmpty ?? true ? 'Required field' : null,
            ),
            const SizedBox(height: 16),
            TextFormField(
              decoration: const InputDecoration(
                labelText: 'Name',
                labelStyle: TextStyle(color: Colors.white70),
              ),
              style: const TextStyle(color: Colors.white),
              onChanged: (value) => name = value,
              validator: (value) =>
                  value?.isEmpty ?? true ? 'Required field' : null,
            ),
            const SizedBox(height: 16),
            TextFormField(
              decoration: const InputDecoration(
                labelText: 'Value',
                labelStyle: TextStyle(color: Colors.white70),
              ),
              style: const TextStyle(color: Colors.white),
              keyboardType: TextInputType.number,
              onChanged: (v) => value = double.tryParse(v) ?? 0,
              validator: (v) =>
                  v?.isEmpty ?? true ? 'Required field' : null,
            ),
            const SizedBox(height: 16),
            DropdownButtonFormField<String>(
              value: category,
              dropdownColor: const Color(0xFF1a1a2e),
              style: const TextStyle(color: Colors.white),
              decoration: const InputDecoration(
                labelText: 'Category',
                labelStyle: TextStyle(color: Colors.white70),
              ),
              items: ['Equity', 'Crypto', 'Real Estate']
                  .map((c) => DropdownMenuItem(
                        value: c,
                        child: Text(c),
                      ))
                  .toList(),
              onChanged: (value) => setState(() => category = value!),
            ),
            const SizedBox(height: 16),
            DropdownButtonFormField<String>(
              value: sentiment,
              dropdownColor: const Color(0xFF1a1a2e),
              style: const TextStyle(color: Colors.white),
              decoration: const InputDecoration(
                labelText: 'Sentiment',
                labelStyle: TextStyle(color: Colors.white70),
              ),
              items: ['Bullish', 'Bearish']
                  .map((s) => DropdownMenuItem(
                        value: s,
                        child: Text(s),
                      ))
                  .toList(),
              onChanged: (value) => setState(() => sentiment = value!),
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFFFFD700),
                foregroundColor: const Color(0xFF0a0a12),
              ),
              onPressed: () {
                if (_formKey.currentState?.validate() ?? false) {
                  context.read<CitadelState>().addAsset(
                        Asset(
                          ticker: ticker,
                          name: name,
                          value: value,
                          category: category,
                          sentiment: sentiment,
                        ),
                      );
                  Navigator.pop(context);
                }
              },
              child: const Text('Add Asset'),
            ),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }
}