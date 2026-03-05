#!/usr/bin/env python3
"""
embedding.py

Script CLI para geração de embeddings usando sentence-transformers.
Rodar: python3 embedding.py "texto do chunk"

Output: JSON com embedding array (384 dimensões)

Exemplo:
    $ python3 embedding.py "Olá, mundo!"
    {"success": true, "embedding": [0.123, -0.456, ...]}
"""

import sys
import json
import torch
from sentence_transformers import SentenceTransformer


def get_embedding(text: str):
    """
    Gera embedding para um texto.
    
    Args:
        text: Texto para embedding
        
    Returns:
        dict com 'success' e 'embedding' (array de floats)
    """
    try:
        # Carregar modelo pré-treinado ( Download na primeira execução )
        # Modelo: paraphrase-MiniLM-L6-v2
        # Dimensão: 384
        # Size: ~80MB
        model = SentenceTransformer('sentence-transformers/paraphrase-MiniLM-L6-v2')
        
        # Avaliar (desabilitar dropout)
        model.eval()
        
        # Sem cálculo de gradientes (save memory)
        with torch.no_grad():
            # encode com normalização para cosine similarity
            embedding = model.encode([text], normalize_embeddings=True)
        
        # Converter tensor para list e retornar
        return {
            'success': True,
            'embedding': embedding[0].tolist()
        }
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }


def debug_model_load():
    """
    Testa carregamento do modelo para verificar se está disponível.
    """
    try:
        model = SentenceTransformer('sentence-transformers/paraphrase-MiniLM-L6-v2')
        # Test encode
        test = model.encode(['test'], normalize_embeddings=True)
        return {
            'success': True,
            'model': 'paraphrase-MiniLM-L6-v2',
            'dimensions': len(test[0]),
            'cuda': torch.cuda.is_available()
        }
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }


if __name__ == '__main__':
    # Se rodar como "python3 embedding.py --check"
    if len(sys.argv) == 2 and sys.argv[1] == '--check':
        result = debug_model_load()
        print(json.dumps(result))
        sys.exit(0 if result['success'] else 1)
    
    # Se não tiver argumentos, mostrar ajuda
    if len(sys.argv) < 2:
        print(json.dumps({
            'success': False,
            'error': 'No text provided. Usage: python3 embedding.py "texto"'
        }))
        sys.exit(1)
    
    # Pegar texto do argumento (todos os args são concatenados)
    text = ' '.join(sys.argv[1:])
    
    # Gerar embedding
    result = get_embedding(text)
    
    # Output JSON para Node.js ler
    print(json.dumps(result))
    
    # Exit code
    sys.exit(0 if result['success'] else 1)