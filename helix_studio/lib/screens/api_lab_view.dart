import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'package:flutter_animate/flutter_animate.dart';

class ApiLabView extends StatefulWidget {
  const ApiLabView({super.key});

  @override
  State<ApiLabView> createState() => _ApiLabViewState();
}

class _ApiLabViewState extends State<ApiLabView> {
  final TextEditingController _urlController = TextEditingController(text: 'http://localhost:3000/api/users');
  String _method = 'GET';
  String _responseBody = '';
  int? _statusCode;
  int _latency = 0;
  bool _isLoading = false;

  final List<String> _methods = ['GET', 'POST', 'PUT', 'DELETE'];

  Future<void> _sendRequest() async {
    setState(() {
      _isLoading = true;
      _responseBody = '';
      _statusCode = null;
    });

    final stopwatch = Stopwatch()..start();
    try {
      final uri = Uri.parse(_urlController.text);
      http.Response response;

      switch (_method) {
        case 'POST':
          response = await http.post(uri); // Add body support later
          break;
        case 'PUT':
          response = await http.put(uri);
          break;
        case 'DELETE':
          response = await http.delete(uri);
          break;
        default:
          response = await http.get(uri);
      }

      stopwatch.stop();
      setState(() {
        _latency = stopwatch.elapsedMilliseconds;
        _statusCode = response.statusCode;
        try {
          // Pretty print JSON
          const JsonDecoder decoder = JsonDecoder();
          const JsonEncoder encoder = JsonEncoder.withIndent('  ');
          final object = decoder.convert(response.body);
          _responseBody = encoder.convert(object);
        } catch (e) {
          _responseBody = response.body;
        }
      });
    } catch (e) {
      setState(() {
        _responseBody = "Error: $e";
      });
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      color: const Color(0xFF0a0a12),
      child: Column(
        children: [
          // Toolbar
          Container(
            padding: const EdgeInsets.all(16),
            color: const Color(0xFF050505),
            child: Row(
              children: [
                // Method Selector
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  decoration: BoxDecoration(
                    color: const Color(0xFF1a1a2e),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: Colors.white10),
                  ),
                  child: DropdownButton<String>(
                    value: _method,
                    underline: const SizedBox(),
                    dropdownColor: const Color(0xFF1a1a2e),
                    style: GoogleFonts.firaCode(color: const Color(0xFFFFD700), fontWeight: FontWeight.bold),
                    items: _methods.map((m) => DropdownMenuItem(value: m, child: Text(m))).toList(),
                    onChanged: (val) => setState(() => _method = val!),
                  ),
                ),
                const SizedBox(width: 16),
                
                // URL Input
                Expanded(
                  child: TextField(
                    controller: _urlController,
                    style: GoogleFonts.firaCode(color: Colors.white),
                    decoration: const InputDecoration(
                      hintText: "Enter Endpoint URL",
                      hintStyle: TextStyle(color: Colors.white24),
                      border: InputBorder.none,
                      fillColor: Color(0xFF1a1a2e),
                      filled: true,
                    ),
                  ),
                ),
                const SizedBox(width: 16),

                // Send Button
                ElevatedButton.icon(
                  onPressed: _isLoading ? null : _sendRequest,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFFFD700),
                    foregroundColor: Colors.black,
                    padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
                  ),
                  icon: _isLoading 
                      ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.black))
                      : const Icon(Icons.send_rounded),
                  label: const Text("SEND"),
                ),
              ],
            ),
          ),

          // Main Area (Split: Params | Response)
          Expanded(
            child: Row(
              children: [
                // Request Body / Params Area
                Expanded(
                  child: Container(
                    decoration: const BoxDecoration(
                      border: Border(right: BorderSide(color: Color(0xFF333333))),
                    ),
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text("REQUEST BODY (JSON)", style: GoogleFonts.inter(color: Colors.grey, fontSize: 12, fontWeight: FontWeight.bold)),
                        const SizedBox(height: 10),
                        Expanded(
                          child: Container(
                            padding: const EdgeInsets.all(16),
                            color: const Color(0xFF050505),
                            child: TextField(
                               maxLines: null,
                               style: GoogleFonts.firaCode(color: Colors.white70, fontSize: 13),
                               decoration: const InputDecoration.collapsed(hintText: "{\n  \"key\": \"value\"\n}"),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),

                // Response Area
                Expanded(
                  child: Container(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                         Row(
                           mainAxisAlignment: MainAxisAlignment.spaceBetween,
                           children: [
                             Text("RESPONSE", style: GoogleFonts.inter(color: Colors.grey, fontSize: 12, fontWeight: FontWeight.bold)),
                             if (_statusCode != null)
                               Container(
                                 padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                 decoration: BoxDecoration(
                                   color: _statusCode! >= 200 && _statusCode! < 300 ? Colors.green.withOpacity(0.2) : Colors.red.withOpacity(0.2),
                                   borderRadius: BorderRadius.circular(4),
                                 ),
                                 child: Row(
                                   children: [
                                     Text("$_statusCode", style: GoogleFonts.firaCode(color: _statusCode! >= 200 && _statusCode! < 300 ? Colors.green : Colors.red, fontWeight: FontWeight.bold)),
                                     const SizedBox(width: 8),
                                     Text("${_latency}ms", style: GoogleFonts.firaCode(color: Colors.grey, fontSize: 12)),
                                   ],
                                 ),
                               ).animate().fadeIn(),
                           ],
                         ),
                        const SizedBox(height: 10),
                        Expanded(
                          child: Container(
                            width: double.infinity,
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                               color: const Color(0xFF050505),
                               borderRadius: BorderRadius.circular(8),
                               border: Border.all(color: const Color(0xFF333333)),
                            ),
                            child: SingleChildScrollView(
                              child: SelectableText(
                                _responseBody,
                                style: GoogleFonts.firaCode(
                                  color: const Color(0xFF00FF00),
                                  fontSize: 13,
                                ),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
