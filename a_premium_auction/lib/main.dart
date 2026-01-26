import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

void main() {
  runApp(
    ChangeNotifierProvider(
      create: (context) => AuctionState(),
      child: const AetherApp(),
    ),
  );
}

class Lot {
  final String title;
  final String artist;
  final int currentPrice;
  final String imageUrl;
  final bool isOpen;
  final List<Bid> bids;

  Lot({
    required this.title,
    required this.artist,
    required this.currentPrice,
    required this.imageUrl,
    this.isOpen = true,
    this.bids = const [],
  });
}

class Bid {
  final int amount;
  final String bidderName;
  final DateTime timestamp;
  final bool isWinning;

  Bid({
    required this.amount,
    required this.bidderName,
    required this.timestamp,
    this.isWinning = false,
  });
}

class AuctionState extends ChangeNotifier {
  final List<Lot> _lots = [];
  List<Lot> get lots => _lots;

  void addLot(Lot lot) {
    _lots.add(lot);
    notifyListeners();
  }

  void removeLot(int index) {
    _lots.removeAt(index);
    notifyListeners();
  }
}

class AetherApp extends StatelessWidget {
  const AetherApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Aether Auctions',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        scaffoldBackgroundColor: const Color(0xFF0a0a12),
        primaryColor: const Color(0xFFFFD700),
        cardColor: const Color(0xFF1a1a2e),
        textTheme: const TextTheme(
          bodyLarge: TextStyle(color: Colors.white),
          bodyMedium: TextStyle(color: Colors.white70),
        ),
        colorScheme: ColorScheme.dark(
          primary: const Color(0xFFFFD700),
          surface: const Color(0xFF1a1a2e),
          onSurface: Colors.white,
        ),
      ),
      home: const AuctionDashboard(),
    );
  }
}

class AuctionDashboard extends StatelessWidget {
  const AuctionDashboard({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Aether Live Auctions'),
        backgroundColor: const Color(0xFF1a1a2e),
      ),
      body: Consumer<AuctionState>(
        builder: (context, state, child) {
          return ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: state.lots.length,
            itemBuilder: (context, index) {
              final lot = state.lots[index];
              return LotCard(lot: lot, index: index);
            },
          );
        },
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showAddLotSheet(context),
        child: const Icon(Icons.add),
      ),
    );
  }

  void _showAddLotSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF1a1a2e),
      builder: (context) => const AddLotForm(),
    );
  }
}

class LotCard extends StatelessWidget {
  final Lot lot;
  final int index;

  const LotCard({super.key, required this.lot, required this.index});

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onLongPress: () {
        Provider.of<AuctionState>(context, listen: false).removeLot(index);
      },
      child: Card(
        margin: const EdgeInsets.only(bottom: 16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ClipRRect(
              borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
              child: Image.network(
                lot.imageUrl,
                height: 200,
                width: double.infinity,
                fit: BoxFit.cover,
                errorBuilder: (context, error, stackTrace) =>
                    const Icon(Icons.error),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    lot.title,
                    style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Artist: ${lot.artist}',
                    style: const TextStyle(color: Colors.white70),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Current Price: \$${lot.currentPrice}',
                    style: TextStyle(
                      color: const Color(0xFFFFD700),
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: lot.isOpen ? Colors.green : Colors.red,
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text(
                      lot.isOpen ? 'OPEN' : 'CLOSED',
                      style: const TextStyle(fontSize: 12),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class AddLotForm extends StatefulWidget {
  const AddLotForm({super.key});

  @override
  AddLotFormState createState() => AddLotFormState();
}

class AddLotFormState extends State<AddLotForm> {
  final _formKey = GlobalKey<FormState>();
  final _titleController = TextEditingController();
  final _artistController = TextEditingController();
  final _priceController = TextEditingController();
  final _imageUrlController = TextEditingController();

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
              controller: _titleController,
              decoration: const InputDecoration(
                labelText: 'Title',
                labelStyle: TextStyle(color: Colors.white70),
              ),
              style: const TextStyle(color: Colors.white),
              validator: (value) =>
                  value?.isEmpty ?? true ? 'Please enter a title' : null,
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _artistController,
              decoration: const InputDecoration(
                labelText: 'Artist',
                labelStyle: TextStyle(color: Colors.white70),
              ),
              style: const TextStyle(color: Colors.white),
              validator: (value) =>
                  value?.isEmpty ?? true ? 'Please enter an artist' : null,
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _priceController,
              decoration: const InputDecoration(
                labelText: 'Starting Price',
                labelStyle: TextStyle(color: Colors.white70),
              ),
              style: const TextStyle(color: Colors.white),
              keyboardType: TextInputType.number,
              validator: (value) =>
                  value?.isEmpty ?? true ? 'Please enter a price' : null,
            ),
            const SizedBox(height: 16),
            TextFormField(
              controller: _imageUrlController,
              decoration: const InputDecoration(
                labelText: 'Image URL',
                labelStyle: TextStyle(color: Colors.white70),
              ),
              style: const TextStyle(color: Colors.white),
              validator: (value) =>
                  value?.isEmpty ?? true ? 'Please enter an image URL' : null,
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: _submitForm,
              child: const Text('Add Lot'),
            ),
            const SizedBox(height: 16),
          ],
        ),
      ),
    );
  }

  void _submitForm() {
    if (_formKey.currentState?.validate() ?? false) {
      final lot = Lot(
        title: _titleController.text,
        artist: _artistController.text,
        currentPrice: int.parse(_priceController.text),
        imageUrl: _imageUrlController.text,
      );
      Provider.of<AuctionState>(context, listen: false).addLot(lot);
      Navigator.pop(context);
    }
  }

  @override
  void dispose() {
    _titleController.dispose();
    _artistController.dispose();
    _priceController.dispose();
    _imageUrlController.dispose();
    super.dispose();
  }
}